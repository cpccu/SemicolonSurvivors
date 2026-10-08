import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createDatabaseHarness, fixtureIds as ids, seedActors, type DatabaseHarness } from "./postgres-harness";

const audienceId = "00000000-0000-4000-8000-000000000701";
const resourceId = "00000000-0000-4000-8000-000000000702";
const readableTables = [
  ["clubs", 2], ["campus_events", 1], ["campus_content", 3], ["content_revisions", 3],
  ["campus_resources", 1], ["community_directory", 1], ["community_routes", 1],
] as const;

describe("login-first database privacy over legacy public records", () => {
  let database: DatabaseHarness;
  beforeAll(async () => {
    database = await createDatabaseHarness();
    await seedActors(database);
    await database.owner.query(`insert into public.campus_events
      (club_id,title,description,category,venue,starts_at,ends_at,registration_deadline,capacity,visibility,status)
      values($1,'Synthetic public event','Synthetic published event for privacy tests.','Technology','Synthetic room',
        now()+interval '1 hour',now()+interval '3 hours',now()+interval '30 minutes',10,'public','published')`, [ids.club]);
    await database.owner.query("insert into public.academic_audiences(id,kind,label,department_match) values($1,'department','Synthetic test audience','Synthetic department')", [audienceId]);
    for (const kind of ["notice", "article", "service"]) {
      const content = await database.owner.query<{ id: string }>(`insert into public.campus_content
        (kind,audience_id,publisher_id,publisher_name,title,body,category,source_url,owner_label,visibility,
          reviewed_at,notice_type,status,eligibility,destination_url)
        values($1,$2,$3,'Synthetic publisher','Synthetic public content','Synthetic content for privacy tests.',
          'Synthetic','https://example.invalid/synthetic','Synthetic owner','public',now(),'general','published',
          'Synthetic eligibility','https://example.invalid/synthetic-form') returning id`, [kind, audienceId, ids.organizer]);
      await database.owner.query(`insert into public.content_revisions(content_id,version,actor_name,reason,snapshot)
        values($1,1,'Synthetic publisher','Synthetic privacy fixture','{"title":"Synthetic revision"}')`, [content.rows[0]!.id]);
    }
    await database.owner.query(`insert into public.campus_resources
      (id,owner_id,publisher_name,title,description,category,visibility,upload_state,mime_type,byte_size)
      values($1,$2,'Synthetic owner','Synthetic public resource','Synthetic resource for privacy tests.',
        'Synthetic','public','ready','text/plain',100)`, [resourceId, ids.studentA]);
    await database.owner.query(`insert into campus_private.resource_objects(resource_id,object_path,expected_mime,preview_text,storage_present)
      values($1,'synthetic/resource.txt','text/plain','Synthetic private-to-campus preview',true)`, [resourceId]);
    await database.owner.query(`insert into public.community_directory
      (kind,title,description,source_label,source_url,reviewed_at,visibility,state,updated_by)
      values('office','Synthetic public office','Synthetic directory description for privacy tests.',
        'Synthetic source','https://example.invalid/synthetic',now(),'public','published',$1)`, [ids.organizer]);
    await database.owner.query(`insert into public.community_routes
      (title,stops,schedules,source_label,source_url,reviewed_at,visibility,state,updated_by)
      values('Synthetic public route','["Synthetic stop A","Synthetic stop B"]','[{"days":[1],"time":"09:00"}]',
        'Synthetic source','https://example.invalid/synthetic',now(),'public','published',$1)`, [ids.organizer]);
  }, 60_000);
  afterAll(async () => { await database?.close(); });
  beforeEach(async () => {
    await database.owner.query("update public.profiles set status='active' where user_id=$1", [ids.studentB]);
  });

  it("revokes every former anonymous campus table grant and the resource-preview RPC", async () => {
    const anonymous = await database.actor(null, "anon");
    for (const [table] of readableTables) {
      expect((await database.owner.query("select has_table_privilege('anon',$1,'SELECT') as allowed", [`public.${table}`])).rows[0].allowed).toBe(false);
      await expect(anonymous.query(`select * from public.${table}`)).rejects.toMatchObject({ code: "42501" });
    }
    await expect(anonymous.query("select public.resource_preview($1)", [resourceId])).rejects.toMatchObject({ code: "42501" });
    expect((await database.owner.query("select has_schema_privilege('anon','campus_private','USAGE') as allowed")).rows[0].allowed).toBe(false);
  });

  it("also hides public records through RLS if anonymous SELECT is accidentally regranted", async () => {
    const anonymous = await database.actor(null, "anon");
    for (const [table] of readableTables) {
      await database.owner.query(`grant select on public.${table} to anon`);
      try {
        expect((await anonymous.query(`select * from public.${table}`)).rows).toEqual([]);
      } finally {
        await database.owner.query(`revoke select on public.${table} from anon`);
      }
    }
  });

  it("keeps public discovery and previews available to active accounts only", async () => {
    const student = await database.actor(ids.studentB);
    for (const [table, count] of readableTables) {
      expect((await student.query(`select * from public.${table}`)).rows).toHaveLength(count);
    }
    expect((await student.query("select public.resource_preview($1) as preview", [resourceId])).rows[0].preview.text).toBe("Synthetic private-to-campus preview");
    for (const status of ["pending", "suspended", "deactivated"]) {
      await database.owner.query("update public.profiles set status=$1 where user_id=$2", [status, ids.studentB]);
      for (const [table] of readableTables) expect((await student.query(`select * from public.${table}`)).rows).toEqual([]);
      await expect(student.query("select public.resource_preview($1)", [resourceId])).rejects.toMatchObject({ code: "42501" });
      // Account state stays readable so existing activation and blocked-account flows work.
      expect((await student.query("select public.campus_access() as access")).rows[0].access.status).toBe(status);
    }
  });

  it("requires an active actor for service-side public-resource storage access", async () => {
    const service = await database.actor(null, "service_role");
    await expect(service.query("select public.resource_storage_record($1,null)", [resourceId])).rejects.toMatchObject({ code: "42501" });
    expect((await service.query("select public.resource_storage_record($1,$2) as object", [resourceId, ids.studentB])).rows[0].object.path).toBe("synthetic/resource.txt");
    await database.owner.query("update public.profiles set status='suspended' where user_id=$1", [ids.studentB]);
    await expect(service.query("select public.resource_storage_record($1,$2)", [resourceId, ids.studentB])).rejects.toMatchObject({ code: "42501" });
    expect((await service.query("select public.identity_health() as version")).rows[0].version).toBe("202610070001");
  });
});
