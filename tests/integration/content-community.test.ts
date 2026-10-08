import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createDatabaseHarness, fixtureIds as ids, seedActors, type DatabaseHarness } from "./postgres-harness";

const audienceId = "00000000-0000-4000-8000-000000000701";

describe("persisted academic content and resource boundaries", () => {
  let database: DatabaseHarness;
  beforeAll(async () => { database = await createDatabaseHarness(); }, 60_000);
  afterAll(async () => { await database?.close(); });
  beforeEach(async () => {
    await database.owner.query("truncate auth.users, public.clubs, public.academic_audiences, public.campus_content, public.campus_resources, public.resource_reports cascade");
    await seedActors(database);
    await database.owner.query("update public.profiles set department='Demo CSE' where user_id=$1", [ids.studentA]);
    await database.owner.query("insert into public.academic_audiences(id,kind,label,department_match) values($1,'department','Synthetic CSE','Demo CSE')", [audienceId]);
    await database.owner.query("insert into public.role_assignments(user_id,role,scope_kind,scope_id) values($1,'academic_publisher','department',$2)", [ids.organizer, audienceId]);
  });

  it("publishes only with exact audience scope and exposes permitted content", async () => {
    const publisher = await database.actor(ids.organizer, "authenticated", "aal2");
    const input = {
      kind: "notice", audienceId, title: "Synthetic room change", body: "This is a synthetic notice for integration tests.", category: "Academic",
      sourceUrl: "https://example.invalid/synthetic-source", ownerLabel: "Synthetic academic publisher", visibility: "campus", reviewedAt: new Date().toISOString(),
      noticeType: "room_change", changeBefore: "Room A", changeAfter: "Room B", status: "published", eligibility: "Synthetic CSE students",
      destinationUrl: null, revisionReason: "Initial synthetic publication", approvedAi: false,
    };
    const saved = (await publisher.query("select public.content_save(null,null,$1::jsonb) as content", [JSON.stringify(input)])).rows[0].content;
    expect(saved.status).toBe("published");
    const student = await database.actor(ids.studentA);
    expect((await student.query("select id,title from public.campus_content")).rows).toHaveLength(1);
    const other = await database.actor(ids.studentB);
    await database.owner.query("update public.profiles set department='Other department' where user_id=$1", [ids.studentB]);
    expect((await other.query("select id from public.campus_content")).rows).toHaveLength(0);
    const anon = await database.actor(null, "anon");
    await expect(anon.query("select id from public.campus_content")).rejects.toMatchObject({ code: "42501" });
    await expect(other.query("select public.content_save(null,null,$1::jsonb)", [JSON.stringify(input)])).rejects.toMatchObject({ code: "42501" });
  });

  it("resource storage finalization is server-only and visibility is enforced", async () => {
    const owner = await database.actor(ids.studentA);
    const metadata = { mimeType: "text/plain", title: "Synthetic notes", description: "Synthetic resource for tests.", department: "Demo CSE", course: "CSE TEST", semester: "2026", category: "Notes", visibility: "campus" };
    const resource = (await owner.query("select public.resource_begin($1::jsonb) as resource", [JSON.stringify(metadata)])).rows[0].resource;
    await expect(owner.query("select public.resource_finish($1,$2,100,'text/plain','synthetic text')", [resource.id, ids.studentA])).rejects.toMatchObject({ code: "42501" });
    const service = await database.actor(null, "service_role");
    await service.query("select public.resource_finish($1,$2,100,'text/plain','synthetic text')", [resource.id, ids.studentA]);
    expect((await owner.query("select id from public.campus_resources where id=$1", [resource.id])).rows).toHaveLength(1);
    const other = await database.actor(ids.studentB);
    expect((await other.query("select id from public.campus_resources where id=$1", [resource.id])).rows).toHaveLength(1);
    await database.owner.query("update public.campus_resources set visibility='private' where id=$1", [resource.id]);
    expect((await other.query("select id from public.campus_resources where id=$1", [resource.id])).rows).toHaveLength(0);
    await expect(other.query("update public.campus_resources set title='forged' where id=$1", [resource.id])).rejects.toMatchObject({ code: "42501" });
  });

  it("optimistic content version conflicts are rejected", async () => {
    const publisher = await database.actor(ids.organizer, "authenticated", "aal2");
    const input = { kind: "article", audienceId, title: "Synthetic article", body: "A sufficiently long synthetic article body for tests.", category: "Help", sourceUrl: "https://example.invalid/article", ownerLabel: "Synthetic publisher", visibility: "campus", reviewedAt: new Date().toISOString(), noticeType: "general", changeBefore: "", changeAfter: "", status: "draft", eligibility: "", destinationUrl: null, revisionReason: "Create draft", approvedAi: false };
    const created = (await publisher.query("select public.content_save(null,null,$1::jsonb) as content", [JSON.stringify(input)])).rows[0].content;
    const update = { ...input, title: "Synthetic article updated", revisionReason: "Correct title" };
    await publisher.query("select public.content_save($1,1,$2::jsonb)", [created.id, JSON.stringify(update)]);
    await expect(publisher.query("select public.content_save($1,1,$2::jsonb)", [created.id, JSON.stringify(update)])).rejects.toMatchObject({ code: "23505" });
  });
});

describe("private complaints and lost-found state transitions", () => {
  let database: DatabaseHarness;
  beforeAll(async () => { database = await createDatabaseHarness(); }, 60_000);
  afterAll(async () => { await database?.close(); });
  beforeEach(async () => {
    await database.owner.query("truncate auth.users, public.clubs, public.community_offices, public.community_media, public.community_items, public.community_complaints cascade");
    await seedActors(database);
  });

  it("keeps complaints private and allows owner escalation only", async () => {
    const officeId = "00000000-0000-4000-8000-000000000801";
    await database.owner.query("insert into public.community_offices(id,title,description) values($1,'Synthetic support office','Synthetic office for tests')", [officeId]);
    const owner = await database.actor(ids.studentA);
    const complaint = (await owner.query("select public.community_create_complaint($1,'Synthetic issue','This is a synthetic complaint description for tests.') as complaint", [officeId])).rows[0].complaint;
    const other = await database.actor(ids.studentB);
    expect((await other.query("select id from public.community_complaints")).rows).toHaveLength(0);
    expect((await owner.query("select id,state from public.community_complaints")).rows[0]).toMatchObject({ id: complaint.id, state: "received" });
    await owner.query("select public.community_complaint_transition($1,1,'escalated','Synthetic owner escalation')", [complaint.id]);
    expect((await owner.query("select state from public.community_complaints where id=$1", [complaint.id])).rows[0].state).toBe("escalated");
    await expect(other.query("select public.community_complaint_message($1,'Private message')", [complaint.id])).rejects.toMatchObject({ code: "42501" });
  });

  it("requires a ready owned photo and serializes lost-found handover", async () => {
    const photoId = "00000000-0000-4000-8000-000000000901";
    await database.owner.query("insert into public.community_media(id,owner_id,object_path,mime_type,byte_size,purpose,state) values($1,$2,'student/item.png','image/png',100,'item','ready')", [photoId, ids.studentA]);
    const owner = await database.actor(ids.studentA);
    const item = (await owner.query("select public.community_create_item($1::jsonb) as item", [JSON.stringify({ photoId, kind: "lost", title: "Synthetic calculator", description: "A synthetic calculator used for state transition tests.", location: "Synthetic library", occurredOn: "2026-10-07" })])).rows[0].item;
    const claimant = await database.actor(ids.studentB);
    const claim = (await claimant.query("select public.community_claim_item($1,'Synthetic ownership evidence that is deliberately fake for tests.') as claim", [item.id])).rows[0].claim;
    await owner.query("select public.community_item_transition($1,1,'accept',$2)", [item.id, claim.id]);
    await expect(owner.query("select public.community_item_transition($1,2,'accept',$2)", [item.id, claim.id])).rejects.toMatchObject({ code: "P0001" });
    await claimant.query("select public.community_item_transition($1,2,'confirm-handover',$2)", [item.id, claim.id]);
    expect((await database.owner.query("select state from public.community_items where id=$1", [item.id])).rows[0].state).toBe("resolved");
    expect((await database.owner.query("select state from public.community_claims where id=$1", [claim.id])).rows[0].state).toBe("completed");
    await expect(database.actor(ids.outsider).then((actor) => actor.query("select * from public.community_claims"))).resolves.toMatchObject({ rows: [] });
  });

  it("does not let inactive users read or write community cases", async () => {
    const student = await database.actor(ids.studentA);
    await database.owner.query("update public.profiles set status='suspended' where user_id=$1", [ids.studentA]);
    await expect(student.query("select public.community_save_preferences('{\"interests\":[\"synthetic\"]}'::jsonb)")).rejects.toMatchObject({ code: "42501" });
    expect((await student.query("select * from public.community_complaints")).rows).toHaveLength(0);
  });
});
