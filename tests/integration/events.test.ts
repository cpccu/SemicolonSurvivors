import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createDatabaseHarness, fixtureIds as ids, seedActors, type DatabaseHarness } from "./postgres-harness";

describe("migrated event invariants in real PostgreSQL", () => {
  let database: DatabaseHarness;
  let eventId: string;
  beforeAll(async () => { database = await createDatabaseHarness(); }, 60_000);
  afterAll(async () => { await database?.close(); });
  beforeEach(async () => {
    await database.owner.query("truncate auth.users, public.clubs cascade");
    await seedActors(database);
    const event = await database.owner.query<{ id: string }>(`insert into public.campus_events
      (club_id,title,description,category,venue,starts_at,ends_at,registration_deadline,capacity,visibility,status)
      values($1,'Synthetic workshop','An original synthetic event for integration tests.','Technology','Test room',
      now()+interval '1 hour',now()+interval '3 hours',now()+interval '30 minutes',1,'public','published') returning id`, [ids.club]);
    eventId = event.rows[0]!.id;
  });

  it("competing connections allocate one seat and one waitlist position", async () => {
    const [first, second] = await Promise.all([database.actor(ids.studentA), database.actor(ids.studentB)]);
    const results = await Promise.all([first.query("select public.event_register($1) as ticket", [eventId]), second.query("select public.event_register($1) as ticket", [eventId])]);
    expect(results.map((result) => result.rows[0].ticket.status).sort()).toEqual(["registered", "waitlisted"]);
    const count = await database.owner.query("select count(*)::int as count from public.event_registrations where event_id=$1 and status='registered'", [eventId]);
    expect(count.rows[0].count).toBe(1);
  });

  it("registration retry is idempotent and cancellation promotes the queue", async () => {
    const first = await database.actor(ids.studentA);
    const second = await database.actor(ids.studentB);
    const initial = await first.query("select public.event_register($1) as ticket", [eventId]);
    const retry = await first.query("select public.event_register($1) as ticket", [eventId]);
    expect(retry.rows[0].ticket).toEqual(initial.rows[0].ticket);
    await second.query("select public.event_register($1)", [eventId]);
    await first.query("select public.event_cancel_registration($1)", [eventId]);
    const promoted = await second.query("select public.event_own_ticket($1) as ticket", [eventId]);
    expect(promoted.rows[0].ticket.status).toBe("registered");
    expect(promoted.rows[0].ticket.ticket_token).toBeTruthy();
  });

  it("check-in rejects wrong club/MFA and atomically recognizes repeated scans", async () => {
    const student = await database.actor(ids.studentA);
    const token = (await student.query("select public.event_register($1) as ticket", [eventId])).rows[0].ticket.ticket_token;
    const wrongClub = await database.actor(ids.outsider, "authenticated", "aal2");
    await expect(wrongClub.query("select public.event_check_in($1,$2)", [eventId, token])).rejects.toMatchObject({ code: "42501" });
    const noMfa = await database.actor(ids.organizer);
    await expect(noMfa.query("select public.event_check_in($1,$2)", [eventId, token])).rejects.toMatchObject({ code: "42501" });
    const [organizerA, organizerB] = await Promise.all([database.actor(ids.organizer, "authenticated", "aal2"), database.actor(ids.organizer, "authenticated", "aal2")]);
    const scans = await Promise.all([organizerA.query("select public.event_check_in($1,$2) as scan", [eventId, token]), organizerB.query("select public.event_check_in($1,$2) as scan", [eventId, token])]);
    expect(scans.map((result) => result.rows[0].scan.already_checked_in).sort()).toEqual([false, true]);
    expect(scans[0]!.rows[0].scan.checked_in_at).toEqual(scans[1]!.rows[0].scan.checked_in_at);
  });

  it("RLS hides another student's ticket and direct writes are denied", async () => {
    const owner = await database.actor(ids.studentA);
    await owner.query("select public.event_register($1)", [eventId]);
    const other = await database.actor(ids.studentB);
    expect((await other.query("select * from public.event_registrations")).rows).toEqual([]);
    await expect(other.query("update public.profiles set status='active'")).rejects.toMatchObject({ code: "42501" });
    await expect(other.query("insert into public.event_registrations(event_id,user_id,status) values($1,$2,'waitlisted')", [eventId, ids.studentB])).rejects.toMatchObject({ code: "42501" });
  });

  it("anonymous access does not expose even published public events, clubs, or tokens", async () => {
    const anon = await database.actor(null, "anon");
    await expect(anon.query("select * from public.campus_events")).rejects.toMatchObject({ code: "42501" });
    await expect(anon.query("select * from public.clubs")).rejects.toMatchObject({ code: "42501" });
    await expect(anon.query("select * from public.event_registrations")).rejects.toMatchObject({ code: "42501" });
    await expect(anon.query("select public.event_register($1)", [eventId])).rejects.toMatchObject({ code: "42501" });
  });

  it("suspension and event cancellation invalidate access and tickets", async () => {
    const student = await database.actor(ids.studentA);
    await student.query("select public.event_register($1)", [eventId]);
    await database.owner.query("update public.profiles set status='suspended' where user_id=$1", [ids.studentA]);
    await expect(student.query("select public.event_own_ticket($1)", [eventId])).rejects.toMatchObject({ code: "42501" });
    const organizer = await database.actor(ids.organizer, "authenticated", "aal2");
    await organizer.query("select public.event_cancel($1)", [eventId]);
    const ticket = await database.owner.query("select status,ticket_token from public.event_registrations where event_id=$1", [eventId]);
    expect(ticket.rows[0]).toEqual({ status: "cancelled", ticket_token: null });
  });

  it("deadline and wrong-event ticket checks are enforced in SQL", async () => {
    const student = await database.actor(ids.studentA);
    const token = (await student.query("select public.event_register($1) as ticket", [eventId])).rows[0].ticket.ticket_token;
    await database.owner.query("update public.campus_events set registration_deadline=now()-interval '1 minute' where id=$1", [eventId]);
    const other = await database.actor(ids.studentB);
    await expect(other.query("select public.event_register($1)", [eventId])).rejects.toMatchObject({ code: "P0001" });
    const organizer = await database.actor(ids.organizer, "authenticated", "aal2");
    const clone = await database.owner.query("insert into public.campus_events select gen_random_uuid(),club_id,title,description,category,venue,starts_at,ends_at,registration_deadline,capacity,visibility,status,created_at,updated_at from public.campus_events where id=$1 returning id", [eventId]);
    await expect(organizer.query("select public.event_check_in($1,$2)", [clone.rows[0].id, token])).rejects.toMatchObject({ code: "P0002" });
  });
});
