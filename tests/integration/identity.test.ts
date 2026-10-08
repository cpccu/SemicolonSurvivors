import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createDatabaseHarness, fixtureIds as ids, seedActors, type DatabaseHarness } from "./postgres-harness";

const roster = (email = "new-student@example.invalid") => [{
  studentId: "CU-TEST-100", email, fullName: "Synthetic New Student", department: "Demo CSE", batch: "Demo 2026",
}];

describe("identity database grants, imports, activation, and rate limits", () => {
  let database: DatabaseHarness;
  beforeAll(async () => { database = await createDatabaseHarness(); }, 60_000);
  afterAll(async () => { await database?.close(); });
  beforeEach(async () => {
    await database.owner.query("truncate auth.users, public.clubs, public.enrollment_roster, campus_private.rate_limit_buckets cascade");
    await seedActors(database);
  });

  it("requires the exact enrollment role, institution, and MFA", async () => {
    const student = await database.actor(ids.studentA, "authenticated", "aal2");
    await expect(student.query("select public.enrollment_stage_import($1,$2)", [ids.institution, JSON.stringify(roster())])).rejects.toMatchObject({ code: "42501" });
    const adminNoMfa = await database.actor(ids.admin);
    await expect(adminNoMfa.query("select public.enrollment_stage_import($1,$2)", [ids.institution, JSON.stringify(roster())])).rejects.toMatchObject({ code: "42501" });
    const admin = await database.actor(ids.admin, "authenticated", "aal2");
    await expect(admin.query("select public.enrollment_stage_import($1,$2)", [ids.otherClub, JSON.stringify(roster())])).rejects.toMatchObject({ code: "42501" });
    await expect(admin.query("select * from public.enrollment_roster")).rejects.toMatchObject({ code: "42501" });
  });

  it("confirms and reimports idempotently without granting roles", async () => {
    const admin = await database.actor(ids.admin, "authenticated", "aal2");
    const preview = (await admin.query("select public.enrollment_stage_import($1,$2) as report", [ids.institution, JSON.stringify(roster())])).rows[0].report;
    expect(preview.records[0].result).toBe("new");
    const saved = (await admin.query("select public.enrollment_confirm_import($1,$2) as report", [preview.batchId, ids.institution])).rows[0].report;
    expect(saved.state).toBe("confirmed");
    const retry = (await admin.query("select public.enrollment_confirm_import($1,$2) as report", [preview.batchId, ids.institution])).rows[0].report;
    expect(retry).toEqual(saved);
    const imported = (await admin.query("select public.enrollment_stage_import($1,$2) as report", [ids.institution, JSON.stringify(roster())])).rows[0].report;
    expect(imported.records[0].result).toBe("unchanged");
    expect((await database.owner.query("select count(*)::int as n from public.enrollment_roster")).rows[0].n).toBe(1);
    expect((await database.owner.query("select count(*)::int as n from public.role_assignments")).rows[0].n).toBe(3);
  });

  it("duplicate rows block confirmation without partial roster writes", async () => {
    const admin = await database.actor(ids.admin, "authenticated", "aal2");
    const preview = (await admin.query("select public.enrollment_stage_import($1,$2) as report", [ids.institution, JSON.stringify([...roster(), ...roster()])])).rows[0].report;
    expect(preview.records.every((record: { reason: string }) => record.reason === "duplicate_in_batch")).toBe(true);
    await expect(admin.query("select public.enrollment_confirm_import($1,$2)", [preview.batchId, ids.institution])).rejects.toMatchObject({ code: "23505" });
    expect((await database.owner.query("select * from public.enrollment_roster")).rows).toHaveLength(0);
  });

  it("concurrent conflicting previews cannot overwrite identity", async () => {
    const [adminA, adminB] = await Promise.all([database.actor(ids.admin, "authenticated", "aal2"), database.actor(ids.admin, "authenticated", "aal2")]);
    const previews = await Promise.all([adminA.query("select public.enrollment_stage_import($1,$2) as report", [ids.institution, JSON.stringify(roster())]), adminB.query("select public.enrollment_stage_import($1,$2) as report", [ids.institution, JSON.stringify(roster("different@example.invalid"))])]);
    const results = await Promise.allSettled([adminA.query("select public.enrollment_confirm_import($1,$2)", [previews[0]!.rows[0].report.batchId, ids.institution]), adminB.query("select public.enrollment_confirm_import($1,$2)", [previews[1]!.rows[0].report.batchId, ids.institution])]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
    expect((await database.owner.query("select * from public.enrollment_roster")).rows).toHaveLength(1);
  });

  it("invitation leasing accepts only the roster address and serializes requests", async () => {
    await database.owner.query("insert into public.enrollment_roster(student_id,email,full_name,department,batch) values('CU-TEST-100','new-student@example.invalid','Synthetic Student','Demo CSE','2026')");
    const [workerA, workerB] = await Promise.all([database.actor(null, "service_role"), database.actor(null, "service_role")]);
    const leases = await Promise.all([workerA.query("select public.enrollment_begin_invitation('CU-TEST-100') as lease"), workerB.query("select public.enrollment_begin_invitation('CU-TEST-100') as lease")]);
    expect(leases.filter((result) => result.rows[0].lease !== null)).toHaveLength(1);
    const lease = leases.find((result) => result.rows[0].lease !== null)!.rows[0].lease;
    expect(lease.email).toBe("new-student@example.invalid");
    await workerA.query("select public.enrollment_finish_invitation($1,$2,null,'uncertain')", [lease.rosterId, lease.leaseId]);
    expect((await workerB.query("select public.enrollment_begin_invitation('CU-TEST-100') as lease")).rows[0].lease).toBeNull();
    const student = await database.actor(ids.studentA);
    await expect(student.query("select public.enrollment_begin_invitation('CU-TEST-100')")).rejects.toMatchObject({ code: "42501" });
  });

  it("existing active managed accounts are never overwritten by a claim", async () => {
    await database.owner.query("insert into public.enrollment_roster(student_id,email,full_name,department,batch) values('CU-TEST-100','studenta@example.invalid','Synthetic Student','Demo CSE','2026')");
    const worker = await database.actor(null, "service_role");
    expect((await worker.query("select public.enrollment_begin_invitation('CU-TEST-100') as lease")).rows[0].lease).toBeNull();
    const record = (await database.owner.query("select auth_status,email_status from public.enrollment_roster")).rows[0];
    expect(record).toEqual({ auth_status: "already_active", email_status: "not_required" });
  });

  it("activation requires confirmed email and managed password and cannot unsuspend", async () => {
    await database.owner.query("delete from public.profiles where user_id=$1", [ids.studentA]);
    await database.owner.query("update auth.users set email_confirmed_at=null,encrypted_password='' where id=$1", [ids.studentA]);
    await database.owner.query("insert into public.enrollment_roster(student_id,email,full_name,department,batch) values('CU-TEST-100','studenta@example.invalid','Synthetic Student','Demo CSE','2026')");
    const student = await database.actor(ids.studentA);
    await expect(student.query("select public.enrollment_bind_identity()")).rejects.toMatchObject({ code: "42501" });
    await database.owner.query("update auth.users set email_confirmed_at=now() where id=$1", [ids.studentA]);
    await student.query("select public.enrollment_bind_identity()");
    await expect(student.query("select public.enrollment_complete_activation()")).rejects.toMatchObject({ code: "42501" });
    await database.owner.query("update auth.users set encrypted_password='fixture-hash' where id=$1", [ids.studentA]);
    expect((await student.query("select public.enrollment_complete_activation() as active")).rows[0].active).toBe(true);
    expect((await student.query("select public.enrollment_complete_activation() as active")).rows[0].active).toBe(true);
    await database.owner.query("update public.profiles set status='suspended' where user_id=$1", [ids.studentA]);
    await expect(student.query("select public.enrollment_complete_activation()")).rejects.toMatchObject({ code: "42501" });
  });

  it("durable rate limits serialize concurrent requests and are service-only", async () => {
    const workers = await Promise.all(Array.from({ length: 10 }, () => database.actor(null, "service_role")));
    const results = await Promise.all(workers.map((worker) => worker.query("select public.consume_rate_limit('signin:global',5,60) as allowed")));
    expect(results.filter((result) => result.rows[0].allowed)).toHaveLength(5);
    const student = await database.actor(ids.studentA);
    await expect(student.query("select public.consume_rate_limit('signin:global',5000,1)")).rejects.toMatchObject({ code: "42501" });
  });
});
