import EmbeddedPostgres from "embedded-postgres";
import { randomUUID } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { createServer } from "node:net";
import { join } from "node:path";
import type { Client } from "pg";

// Real PostgreSQL validates SQL/RLS; these claim fixtures do not validate Supabase JWT signing.
const authFixture = `
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create schema auth;
create table auth.users (
  id uuid primary key, email text unique, email_confirmed_at timestamptz, encrypted_password text
);
create schema storage;
create table storage.buckets (
  id text primary key, name text not null, public boolean not null default false,
  file_size_limit bigint, allowed_mime_types text[]
);
create table storage.objects (
  id uuid primary key default gen_random_uuid(), bucket_id text not null,
  name text not null, owner_id uuid, metadata jsonb, unique(bucket_id,name)
);
create function auth.jwt() returns jsonb language sql stable as
$$ select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$;
create function auth.uid() returns uuid language sql stable as
$$ select nullif(auth.jwt()->>'sub','')::uuid $$;
grant usage on schema public, auth to anon, authenticated, service_role;
grant execute on function auth.uid(), auth.jwt() to anon, authenticated, service_role;
`;

async function availablePort(): Promise<number> {
  const server = createServer();
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Test port unavailable");
  await new Promise<void>((resolve) => server.close(() => resolve()));
  return address.port;
}

export async function createDatabaseHarness() {
  const directory = await mkdtemp("/tmp/omnirush/campusos-postgres-");
  const database = new EmbeddedPostgres({
    databaseDir: join(directory, "data"), port: await availablePort(),
    user: "campus_test", password: randomUUID(), persistent: false,
    createPostgresUser: false, onLog: () => {}, onError: () => {},
  });
  let initialized = false;
  const connections = new Set<Client>();
  try {
    await database.initialise();
    await database.start();
    initialized = true;
    const owner = database.getPgClient();
    await owner.connect();
    connections.add(owner);
    await owner.query(authFixture);
    for (const name of ["202610070001_identity.sql", "202610070002_events.sql", "202610070003_content.sql", "202610070004_community.sql", "202610070005_storage.sql", "202610080001_campus_privacy.sql", "202610080002_administration.sql"]) {
      await owner.query(await readFile(join(process.cwd(), "supabase/migrations", name), "utf8"));
    }
    await owner.query("insert into campus_private.community_configuration(singleton,institution_id) values(true,$1)", ["00000000-0000-4000-8000-000000000201"]);
    async function actor(userId: string | null, role = "authenticated", assurance = "aal1") {
      const client = database.getPgClient();
      await client.connect();
      connections.add(client);
      if (!["authenticated", "anon", "service_role"].includes(role)) throw new Error("Invalid test role");
      await client.query(`set role ${role}`);
      await client.query("select set_config('request.jwt.claims',$1,false)", [JSON.stringify({ sub: userId, aal: assurance })]);
      return client;
    }
    async function close() {
      await Promise.all([...connections].map((client) => client.end()));
      await database.stop();
      await rm(directory, { recursive: true, force: true });
    }
    return { owner, actor, close };
  } catch (error) {
    await Promise.all([...connections].map((client) => client.end().catch(() => {})));
    if (initialized) await database.stop();
    await rm(directory, { recursive: true, force: true });
    throw error;
  }
}

export type DatabaseHarness = Awaited<ReturnType<typeof createDatabaseHarness>>;

export const fixtureIds = {
  studentA: "00000000-0000-4000-8000-000000000001",
  studentB: "00000000-0000-4000-8000-000000000002",
  organizer: "00000000-0000-4000-8000-000000000003",
  outsider: "00000000-0000-4000-8000-000000000004",
  admin: "00000000-0000-4000-8000-000000000005",
  club: "00000000-0000-4000-8000-000000000101",
  otherClub: "00000000-0000-4000-8000-000000000102",
  institution: "00000000-0000-4000-8000-000000000201",
} as const;

export async function seedActors(database: DatabaseHarness) {
  for (const name of ["studentA", "studentB", "organizer", "outsider", "admin"] as const) {
    await database.owner.query("insert into auth.users(id,email,email_confirmed_at,encrypted_password) values($1,$2,now(),'fixture-password-hash')", [fixtureIds[name], `${name.toLowerCase()}@example.invalid`]);
    await database.owner.query("insert into public.profiles(user_id,full_name,status) values($1,$2,'active')", [fixtureIds[name], `Synthetic ${name}`]);
  }
  await database.owner.query("insert into public.role_assignments(user_id,role,scope_kind,scope_id) values($1,'club_organizer','club',$2),($3,'club_organizer','club',$4),($5,'enrollment_admin','institution',$6)", [fixtureIds.organizer, fixtureIds.club, fixtureIds.outsider, fixtureIds.otherClub, fixtureIds.admin, fixtureIds.institution]);
  await database.owner.query("insert into public.clubs(id,name) values($1,'Synthetic Computing Club'),($2,'Synthetic Other Club')", [fixtureIds.club, fixtureIds.otherClub]);
}
