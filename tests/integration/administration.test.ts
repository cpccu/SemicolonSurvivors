import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createDatabaseHarness, fixtureIds as ids, seedActors, type DatabaseHarness } from "./postgres-harness";

describe("scoped administration controls", () => {
  let database: DatabaseHarness;

  beforeAll(async () => { database = await createDatabaseHarness(); }, 60_000);
  afterAll(async () => { await database?.close(); });
  beforeEach(async () => {
    await database.owner.query("truncate auth.users, public.clubs, public.audit_events cascade");
    await seedActors(database);
    await database.owner.query(
      "insert into public.role_assignments(user_id,role,scope_kind,scope_id) values($1,'system_admin','institution',$2)",
      [ids.admin, ids.institution],
    );
  });

  it("denies lookup and club creation without exact institution system admin AAL2", async () => {
    const student = await database.actor(ids.studentA, "authenticated", "aal2");
    await expect(student.query("select public.administration_lookup($1,'')", [ids.institution])).rejects.toMatchObject({ code: "42501" });

    const steppedDown = await database.actor(ids.admin, "authenticated", "aal1");
    await expect(steppedDown.query("select public.administration_lookup($1,'')", [ids.institution])).rejects.toMatchObject({ code: "42501" });

    const admin = await database.actor(ids.admin, "authenticated", "aal2");
    await expect(admin.query("select public.administration_lookup($1,'')", [ids.otherClub])).rejects.toMatchObject({ code: "42501" });
    await expect(admin.query("select public.administration_create_club($1,$2,$3)", [ids.institution, "", "description"])).rejects.toMatchObject({ code: "22023" });
  });

  it("returns bounded minimal users and completes audited club organizer flow", async () => {
    const admin = await database.actor(ids.admin, "authenticated", "aal2");
    const lookup = (await admin.query("select public.administration_lookup($1,$2) as value", [ids.institution, "Synthetic"])).rows[0].value;
    expect(lookup.profiles).toHaveLength(5);
    expect(lookup.profiles[0]).toEqual(expect.objectContaining({ fullName: expect.any(String), userId: expect.any(String) }));
    expect(lookup.profiles[0]).not.toHaveProperty("email");
    expect(lookup.clubs).toHaveLength(2);

    const created = (await admin.query("select public.administration_create_club($1,$2,$3) as value", [ids.institution, "Synthetic Robotics Club", "A bounded synthetic club description."])).rows[0].value;
    expect(created).toEqual(expect.objectContaining({ name: "Synthetic Robotics Club", description: "A bounded synthetic club description." }));
    expect((await database.owner.query("select action,details from public.audit_events where target_id=$1", [created.id])).rows[0]).toMatchObject({ action: "club.create" });

    const roleData = JSON.stringify({ role: "club_organizer", scopeKind: "club", scopeId: created.id });
    await admin.query("select public.community_admin_change($1,$2,'grant-role',$3::jsonb,$4)", [ids.institution, ids.studentA, roleData, "Synthetic club organizer assignment"]);
    expect((await database.owner.query("select 1 from public.role_assignments where user_id=$1 and role='club_organizer' and scope_id=$2", [ids.studentA, created.id])).rows).toHaveLength(1);

    await admin.query("select public.community_admin_change($1,$2,'revoke-role',$3::jsonb,$4)", [ids.institution, ids.studentA, roleData, "Synthetic club organizer revocation"]);
    expect((await database.owner.query("select 1 from public.role_assignments where user_id=$1 and role='club_organizer' and scope_id=$2", [ids.studentA, created.id])).rows).toHaveLength(0);
    await expect(admin.query("select public.community_admin_change($1,$2,'grant-role',$3::jsonb,$4)", [ids.institution, ids.admin, roleData, "Self grant must be rejected"])).rejects.toMatchObject({ code: "42501" });
  });

  it("rejects a club organizer assignment for a missing club scope", async () => {
    const admin = await database.actor(ids.admin, "authenticated", "aal2");
    const roleData = JSON.stringify({ role: "club_organizer", scopeKind: "club", scopeId: ids.institution });
    await expect(admin.query("select public.community_admin_change($1,$2,'grant-role',$3::jsonb,$4)", [ids.institution, ids.studentA, roleData, "Missing club scope validation"])).rejects.toMatchObject({ code: "22023" });
  });
});
