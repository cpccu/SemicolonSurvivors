import { readFile } from "node:fs/promises";
import { join } from "node:path";
import pg from "pg";

const { Client } = pg;
const connectionString = process.env.SUPABASE_DB_URL?.trim();
if (!connectionString) {
  console.error("SUPABASE_DB_URL is required; get it from Supabase Connect and keep it in ignored .env.local.");
  process.exit(1);
}

const migrations = [
  "202610070001_identity.sql",
  "202610070002_events.sql",
  "202610070003_content.sql",
  "202610070004_community.sql",
  "202610070005_storage.sql",
  "202610080001_campus_privacy.sql",
  "202610080002_administration.sql",
];
const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });

try {
  await client.connect();
  const existing = await client.query("select to_regclass('public.profiles') is not null as exists");
  if (existing.rows[0]?.exists) {
    throw new Error("CampusOS identity tables already exist; refusing to replay non-idempotent migrations.");
  }
  for (const name of migrations) {
    process.stdout.write(`Applying ${name}... `);
    await client.query(await readFile(join(process.cwd(), "supabase/migrations", name), "utf8"));
    console.log("done");
  }
  console.log("CampusOS migrations applied. Configure community institution metadata before using staff/community workflows.");
} catch (error) {
  console.error(error instanceof Error ? error.message : "Migration failed.");
  process.exitCode = 1;
} finally {
  await client.end().catch(() => {});
}
