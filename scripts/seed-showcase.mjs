import { chmod, mkdir, readFile, writeFile } from "node:fs/promises";
import { randomBytes, randomUUID } from "node:crypto";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const credentialsFile = join(repoRoot, "scripts", ".seed-showcase-credentials.json");
const day = 24 * 60 * 60 * 1000;

const showcase = {
  users: [
    {
      key: "student",
      label: "student",
      email: "showcase.student@campusos-demo.example",
      fullName: "Showcase Student",
      studentId: "SHOWCASE-STUDENT-001",
      persona: "student",
    },
    {
      key: "organizer",
      label: "club organizer",
      email: "showcase.organizer@campusos-demo.example",
      fullName: "Showcase Club Organizer",
      studentId: "SHOWCASE-ORGANIZER-001",
      persona: "club_organizer",
    },
    {
      key: "support",
      label: "support staff",
      email: "showcase.support@campusos-demo.example",
      fullName: "Showcase Support Staff",
      studentId: "SHOWCASE-SUPPORT-001",
      persona: "support_staff",
    },
  ],
  department: "Computer Science",
  batch: "2026",
  clubName: "CampusOS Showcase Club",
  officeTitle: "CampusOS Showcase Support Office",
  eventTitle: "CampusOS Showcase Welcome",
  directoryTitle: "CampusOS Showcase Student Services",
  routeTitle: "CampusOS Showcase Shuttle",
  audienceLabel: "CampusOS Showcase Computer Science",
  articleTitle: "CampusOS Showcase: Getting Started",
  resourceTitle: "CampusOS Showcase Quickstart Notes",
  itemTitle: "CampusOS Showcase Found Water Bottle",
  mediaPath: "showcase/campusos-found-water-bottle.png",
};

const minimalPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADUlEQVR42mNk+M/wHwAF/gL+J4XfXwAAAABJRU5ErkJggg==",
  "base64",
);
const resourceText =
  "CampusOS Showcase Quickstart\n\n" +
  "This synthetic resource keeps the public campus resource collection populated for local demonstrations.\n";

function parseEnvValue(value) {
  const trimmed = value.trim();
  if (trimmed.length >= 2 && ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'")))) {
    return trimmed.slice(1, -1).replace(/\\n/g, "\n").replace(/\\"/g, '"');
  }
  return trimmed;
}

async function loadEnvFile(path) {
  let contents;
  try {
    contents = await readFile(path, "utf8");
  } catch (error) {
    if (error?.code === "ENOENT") return;
    throw error;
  }
  for (const line of contents.split(/\r?\n/u)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separator = trimmed.indexOf("=");
    if (separator < 1) continue;
    const name = trimmed.slice(0, separator).trim();
    if (!/^[A-Z_][A-Z0-9_]*$/u.test(name) || process.env[name] !== undefined) continue;
    process.env[name] = parseEnvValue(trimmed.slice(separator + 1));
  }
}

function requiredEnv(...names) {
  for (const name of names) {
    const value = process.env[name]?.trim();
    if (value) return value;
  }
  throw new Error(`${names.join(" or ")} is required in .env.local.`);
}

function configFromEnv() {
  const url = requiredEnv("NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_URL").replace(/\/+$/u, "");
  const key = requiredEnv("SUPABASE_SECRET_KEY", "SUPABASE_SERVICE_ROLE_KEY");
  return { url, key };
}

function safeFailure(status, code) {
  return code ? `request failed with HTTP ${status} (${code})` : `request failed with HTTP ${status}`;
}

function asObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

class SupabaseRest {
  constructor(config) {
    this.url = config.url;
    this.key = config.key;
  }

  headers(extra = {}) {
    return {
      apikey: this.key,
      Authorization: `Bearer ${this.key}`,
      Accept: "application/json",
      ...extra,
    };
  }

  async request(path, options = {}) {
    const response = await fetch(`${this.url}${path}`, {
      method: options.method ?? "GET",
      headers: this.headers(options.headers),
      body: options.body,
    });
    const text = await response.text();
    let payload = null;
    if (text) {
      try {
        payload = JSON.parse(text);
      } catch {
        payload = null;
      }
    }
    if (!response.ok) {
      const errorBody = asObject(payload);
      throw new Error(safeFailure(response.status, typeof errorBody.code === "string" ? errorBody.code : undefined));
    }
    return payload;
  }

  postgrestUrl(table, filters = {}, query = {}) {
    const url = new URL(`${this.url}/rest/v1/${table}`);
    for (const [name, value] of Object.entries(filters)) url.searchParams.set(name, `eq.${value}`);
    for (const [name, value] of Object.entries(query)) {
      if (value !== undefined && value !== null) url.searchParams.set(name, String(value));
    }
    return `${url.pathname}${url.search}`;
  }

  async rows(table, filters = {}, query = {}, schema = "public") {
    const headers = schema === "public" ? {} : { "Accept-Profile": schema };
    const result = await this.request(this.postgrestUrl(table, filters, query), { headers });
    return Array.isArray(result) ? result : [];
  }

  async insert(table, row, schema = "public") {
    const headers = {
      Prefer: "return=representation",
      ...(schema === "public" ? {} : { "Content-Profile": schema, "Accept-Profile": schema }),
      "Content-Type": "application/json",
    };
    const result = await this.request(`/rest/v1/${table}`, {
      method: "POST",
      headers,
      body: JSON.stringify(row),
    });
    return Array.isArray(result) ? result[0] ?? null : result;
  }

  async update(table, filters, patch, schema = "public") {
    const headers = {
      Prefer: "return=representation",
      ...(schema === "public" ? {} : { "Content-Profile": schema, "Accept-Profile": schema }),
      "Content-Type": "application/json",
    };
    const result = await this.request(this.postgrestUrl(table, filters), {
      method: "PATCH",
      headers,
      body: JSON.stringify(patch),
    });
    return Array.isArray(result) ? result[0] ?? null : result;
  }

  async upload(bucket, objectPath, bytes, mimeType) {
    const path = objectPath.split("/").map(encodeURIComponent).join("/");
    const response = await fetch(`${this.url}/storage/v1/object/${encodeURIComponent(bucket)}/${path}`, {
      method: "POST",
      headers: this.headers({
        "Content-Type": mimeType,
        "x-upsert": "true",
        "cache-control": "3600",
      }),
      body: bytes,
    });
    if (!response.ok) throw new Error(safeFailure(response.status));
  }
}

function generatedPassword() {
  return `C0s!${randomBytes(24).toString("base64url")}aA9!`;
}

async function readCredentials() {
  try {
    const contents = await readFile(credentialsFile, "utf8");
    const parsed = JSON.parse(contents);
    if (!parsed || typeof parsed !== "object" || !parsed.users || typeof parsed.users !== "object") {
      throw new Error("invalid shape");
    }
    return parsed;
  } catch (error) {
    if (error?.code === "ENOENT") return { version: 1, users: {} };
    if (error instanceof SyntaxError || error?.message === "invalid shape") {
      throw new Error("The local showcase credentials file is invalid; remove it and rerun the seed.");
    }
    throw error;
  }
}

async function prepareCredentials() {
  const current = await readCredentials();
  const users = {};
  for (const spec of showcase.users) {
    const saved = asObject(current.users[spec.key]);
    users[spec.key] = {
      email: spec.email,
      password: typeof saved.password === "string" && saved.password.length >= 8 ? saved.password : generatedPassword(),
      ...(typeof saved.totpSecret === "string" && saved.totpSecret.length >= 16 ? { totpSecret: saved.totpSecret } : {}),
    };
  }
  const contents = JSON.stringify({ version: 1, users }, null, 2) + "\n";
  await mkdir(dirname(credentialsFile), { recursive: true });
  await writeFile(credentialsFile, contents, { encoding: "utf8", mode: 0o600 });
  await chmod(credentialsFile, 0o600);
  return users;
}

async function listAuthUsers(client, email) {
  for (let page = 1; page <= 100; page += 1) {
    const query = new URLSearchParams({ page: String(page), per_page: "1000" });
    const payload = await client.request(`/auth/v1/admin/users?${query}`);
    const users = Array.isArray(payload) ? payload : Array.isArray(payload?.users) ? payload.users : [];
    const match = users.find((user) => typeof user?.email === "string" && user.email.toLowerCase() === email.toLowerCase());
    if (match) return match;
    if (users.length < 1000) break;
  }
  return null;
}

async function ensureAuthUser(client, spec, password) {
  let user = await listAuthUsers(client, spec.email);
  const metadata = { ...asObject(user?.user_metadata), campusos_seed: "showcase", persona: spec.persona };
  if (!user) {
    user = await client.request("/auth/v1/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: spec.email, password, email_confirm: true, user_metadata: metadata }),
    });
  } else {
    user = await client.request(`/auth/v1/admin/users/${encodeURIComponent(user.id)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: spec.email,
        password,
        email_confirm: true,
        ban_duration: "none",
        user_metadata: metadata,
      }),
    });
  }
  user = asObject(user?.user ?? user);
  if (typeof user.id !== "string" || !user.id) throw new Error(`Auth ${spec.label} user did not return an ID.`);
  const confirmed = user.email_confirmed_at ?? user.confirmed_at;
  if (!confirmed) {
    const checked = await client.request(`/auth/v1/admin/users/${encodeURIComponent(user.id)}`);
    user = asObject(checked?.user ?? checked);
  }
  if (!user.email_confirmed_at && !user.confirmed_at) throw new Error(`Auth ${spec.label} user is not confirmed.`);
  if (user.banned_until && Date.parse(user.banned_until) > Date.now()) throw new Error(`Auth ${spec.label} user remains banned.`);
  return user;
}

async function oneRow(client, table, filters, select = "*", schema = "public") {
  const rows = await client.rows(table, filters, { select, limit: "2" }, schema);
  if (rows.length > 1) throw new Error(`Showcase marker is duplicated in ${table}.`);
  return rows[0] ?? null;
}

async function ensureProfile(client, spec, userId) {
  const row = await oneRow(client, "profiles", { user_id: userId });
  const profile = {
    user_id: userId,
    full_name: spec.fullName,
    status: "active",
    student_id: spec.studentId,
    department: showcase.department,
    batch: showcase.batch,
  };
  return row ? (await client.update("profiles", { user_id: userId }, profile)) ?? row : await client.insert("profiles", profile);
}

async function ensureRoster(client, spec, userId) {
  let row = await oneRow(client, "enrollment_roster", { student_id: spec.studentId });
  if (!row) row = await oneRow(client, "enrollment_roster", { email: spec.email });
  if (row?.user_id && row.user_id !== userId) throw new Error(`Enrollment identity conflict for ${spec.label}.`);
  const roster = {
    student_id: spec.studentId,
    email: spec.email,
    full_name: spec.fullName,
    department: showcase.department,
    batch: showcase.batch,
    approved: true,
    user_id: userId,
    activated_at: new Date().toISOString(),
    auth_status: "provisioned",
    email_status: "not_required",
    invitation_attempts: 0,
    invitation_lease: null,
    invitation_started_at: null,
    updated_at: new Date().toISOString(),
  };
  return row ? (await client.update("enrollment_roster", { id: row.id }, roster)) ?? row : await client.insert("enrollment_roster", roster);
}

async function ensureAssignment(client, userId, role, scopeKind, scopeId) {
  const filters = { user_id: userId, role, scope_kind: scopeKind, scope_id: scopeId };
  const existing = await oneRow(client, "role_assignments", filters, "id,user_id,role,scope_kind,scope_id");
  return existing ?? (await client.insert("role_assignments", filters));
}

async function ensureClub(client) {
  const existing = await oneRow(client, "clubs", { name: showcase.clubName });
  const values = { name: showcase.clubName, description: "Synthetic club used to keep the CampusOS showcase collection populated." };
  return existing ? (await client.update("clubs", { id: existing.id }, values)) ?? existing : await client.insert("clubs", values);
}

async function ensureOffice(client, supportId) {
  const existing = await oneRow(client, "community_offices", { title: showcase.officeTitle });
  const values = {
    title: showcase.officeTitle,
    description: "Synthetic support office used by the CampusOS showcase.",
    default_staff_id: supportId,
    active: true,
  };
  return existing ? (await client.update("community_offices", { id: existing.id }, values)) ?? existing : await client.insert("community_offices", values);
}

function futureDates() {
  const now = Date.now();
  return {
    deadline: new Date(now + 5 * day).toISOString(),
    starts: new Date(now + 7 * day).toISOString(),
    ends: new Date(now + 7 * day + 2 * 60 * 60 * 1000).toISOString(),
  };
}

async function ensureEvent(client, clubId) {
  const dates = futureDates();
  const existing = await oneRow(client, "campus_events", { title: showcase.eventTitle });
  if (existing?.club_id && existing.club_id !== clubId) throw new Error("Showcase event marker belongs to another club.");
  const values = {
    club_id: clubId,
    title: showcase.eventTitle,
    description: "A synthetic campus event that demonstrates the published event collection and registration flow.",
    category: "Community",
    venue: "CampusOS Showcase Hall",
    starts_at: dates.starts,
    ends_at: dates.ends,
    registration_deadline: dates.deadline,
    capacity: 120,
    visibility: "public",
    status: "published",
    updated_at: new Date().toISOString(),
  };
  return existing ? (await client.update("campus_events", { id: existing.id }, values)) ?? existing : await client.insert("campus_events", values);
}

async function ensureAudience(client) {
  const existing = await oneRow(client, "academic_audiences", { label: showcase.audienceLabel });
  const values = { kind: "department", label: showcase.audienceLabel, department_match: showcase.department };
  if (existing && existing.kind !== values.kind) throw new Error("Showcase audience marker has an incompatible kind.");
  return existing ? (await client.update("academic_audiences", { id: existing.id }, values)) ?? existing : await client.insert("academic_audiences", values);
}

async function ensureArticle(client, audienceId, publisherId, publisherName) {
  const reviewedAt = new Date(Date.now() - 1000).toISOString();
  const values = {
    kind: "article",
    audience_id: audienceId,
    publisher_id: publisherId,
    publisher_name: publisherName,
    title: showcase.articleTitle,
    body: "This approved synthetic article keeps the CampusOS article collection ready for a local showcase.",
    category: "Getting started",
    source_url: "https://example.edu/campus/showcase",
    owner_label: "CampusOS Showcase Editorial Desk",
    visibility: "public",
    reviewed_at: reviewedAt,
    expires_at: null,
    opens_at: null,
    closes_at: null,
    eligibility: "Current campus users",
    destination_url: "https://example.edu/campus/showcase",
    notice_type: "general",
    change_before: "",
    change_after: "",
    approved_ai: true,
    status: "published",
    version: 1,
    updated_at: new Date().toISOString(),
  };
  let article = await oneRow(client, "campus_content", { title: showcase.articleTitle });
  if (article && article.kind !== "article") throw new Error("Showcase article marker has an incompatible kind.");
  article = article ? (await client.update("campus_content", { id: article.id }, values)) ?? article : await client.insert("campus_content", values);
  const revision = await oneRow(client, "content_revisions", { content_id: article.id, version: article.version }, "id");
  if (!revision) {
    await client.insert("content_revisions", {
      content_id: article.id,
      version: article.version,
      actor_name: publisherName,
      reason: "Initial showcase article publication",
      snapshot: article,
    });
  }
  return article;
}

async function ensureContent(client, { kind, title, body, category, noticeType, audienceId, publisherId, publisherName, approvedAi = false, destinationUrl = null, eligibility = "Current campus users" }) {
  const reviewedAt = new Date(Date.now() - 1000).toISOString();
  const values = {
    kind, audience_id: audienceId, publisher_id: publisherId, publisher_name: publisherName,
    title, body, category, source_url: "https://example.edu/campus/showcase", owner_label: "CampusOS Showcase Editorial Desk",
    visibility: "public", reviewed_at: reviewedAt, expires_at: null, opens_at: null, closes_at: null,
    eligibility, destination_url: destinationUrl, notice_type: noticeType, change_before: "", change_after: "",
    approved_ai: approvedAi, status: "published", version: 1, updated_at: new Date().toISOString(),
  };
  let record = await oneRow(client, "campus_content", { title });
  if (record && record.kind !== kind) throw new Error(`Showcase content marker ${title} has an incompatible kind.`);
  record = record ? (await client.update("campus_content", { id: record.id }, values)) ?? record : await client.insert("campus_content", values);
  const revision = await oneRow(client, "content_revisions", { content_id: record.id, version: record.version }, "id");
  if (!revision) await client.insert("content_revisions", { content_id: record.id, version: record.version, actor_name: publisherName, reason: "Initial showcase content publication", snapshot: record });
  return record;
}

async function ensureDirectory(client, updatedBy) {
  const reviewedAt = new Date(Date.now() - 1000).toISOString();
  const values = {
    kind: "guide",
    title: showcase.directoryTitle,
    description: "A synthetic public directory entry for the CampusOS showcase and student service discovery.",
    location: "CampusOS Welcome Desk",
    contact: "welcome@example.edu",
    source_label: "CampusOS Showcase Directory",
    source_url: "https://example.edu/campus/directory",
    reviewed_at: reviewedAt,
    visibility: "public",
    state: "published",
    updated_by: updatedBy,
  };
  const existing = await oneRow(client, "community_directory", { title: showcase.directoryTitle });
  return existing ? (await client.update("community_directory", { id: existing.id }, values)) ?? existing : await client.insert("community_directory", values);
}

async function ensureRoute(client, updatedBy) {
  const reviewedAt = new Date(Date.now() - 1000).toISOString();
  const values = {
    title: showcase.routeTitle,
    stops: ["Main Gate", "Showcase Hall"],
    schedules: [{ time: "08:30", days: [1, 2, 3, 4, 5] }],
    exceptions: [],
    notice: "Synthetic route for the CampusOS showcase.",
    source_label: "CampusOS Showcase Transport Desk",
    source_url: "https://example.edu/campus/transport",
    reviewed_at: reviewedAt,
    visibility: "public",
    state: "published",
    updated_by: updatedBy,
  };
  const existing = await oneRow(client, "community_routes", { title: showcase.routeTitle });
  return existing ? (await client.update("community_routes", { id: existing.id }, values)) ?? existing : await client.insert("community_routes", values);
}

async function ensureFoundItem(client, ownerId) {
  const existingItem = await oneRow(client, "community_items", { title: showcase.itemTitle });
  if (existingItem) {
    if (existingItem.owner_id !== ownerId) throw new Error("Showcase found-item marker belongs to another owner.");
    if (existingItem.state !== "open") {
      return (await client.update("community_items", { id: existingItem.id }, { state: "open", version: Number(existingItem.version ?? 1) + 1, updated_at: new Date().toISOString() })) ?? existingItem;
    }
    return existingItem;
  }

  let media = await oneRow(client, "community_media", { object_path: showcase.mediaPath });
  if (media?.owner_id && media.owner_id !== ownerId) throw new Error("Showcase media marker belongs to another owner.");
  if (media?.purpose && media.purpose !== "item") throw new Error("Showcase media marker has an incompatible purpose.");
  if (!media) {
    media = await client.insert("community_media", {
      id: randomUUID(),
      owner_id: ownerId,
      object_path: showcase.mediaPath,
      mime_type: "image/png",
      byte_size: minimalPng.length,
      purpose: "item",
      state: "pending",
    });
  }
  if (!media?.id) throw new Error("Showcase media did not return an ID.");

  if (media.state !== "ready" && media.state !== "attached") {
    await client.upload("campus-community", showcase.mediaPath, minimalPng, "image/png");
    media = (await client.update("community_media", { id: media.id }, { state: "ready" })) ?? media;
  }
  if (media.state !== "ready" && media.state !== "attached") throw new Error("Showcase media could not be made ready.");

  const item = await client.insert("community_items", {
    owner_id: ownerId,
    kind: "found",
    title: showcase.itemTitle,
    description: "A synthetic found item posted to keep the CampusOS lost-and-found collection populated.",
    location: "Showcase Hall reception",
    occurred_on: new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dhaka" }).format(new Date()),
    photo_id: media.id,
    state: "open",
    version: 1,
  });
  if (!item?.id) throw new Error("Showcase found item did not return an ID.");
  await client.update("community_media", { id: media.id }, { state: "attached", entity_id: item.id });
  return item;
}

async function ensureResource(client, ownerId, publisherName, database) {
  if (!database) throw new Error("SUPABASE_DB_URL is required to seed private resource metadata safely.");
  let resource = await oneRow(client, "campus_resources", { title: showcase.resourceTitle });
  if (resource?.owner_id && resource.owner_id !== ownerId) throw new Error("Showcase resource marker belongs to another owner.");
  if (!resource) {
    resource = await client.insert("campus_resources", {
      id: randomUUID(),
      owner_id: ownerId,
      publisher_name: publisherName,
      title: showcase.resourceTitle,
      description: "A ready public text resource for the CampusOS showcase collection.",
      department: showcase.department,
      course: "CAMPUSOS-DEMO",
      semester: showcase.batch,
      category: "Orientation",
      visibility: "public",
      upload_state: "pending",
      approved_ai: false,
      version: 1,
    });
  }
  if (!resource?.id) throw new Error("Showcase resource did not return an ID.");
  const objectResult = await database.query("select resource_id, object_path, expected_mime, storage_present from campus_private.resource_objects where resource_id = $1", [resource.id]);
  let object = objectResult.rows[0] ?? null;
  const objectPath = object?.object_path ?? `${ownerId}/${resource.id}.txt`;
  if (object && object.expected_mime !== "text/plain") throw new Error("Showcase resource object has an incompatible MIME type.");
  if (!object) {
    await database.query("insert into campus_private.resource_objects(resource_id, object_path, expected_mime, preview_text, storage_present) values ($1, $2, $3, $4, false)", [resource.id, objectPath, "text/plain", resourceText]);
    object = { resource_id: resource.id, object_path: objectPath, expected_mime: "text/plain", storage_present: false };
  }
  await client.upload("campus-resources", objectPath, Buffer.from(resourceText, "utf8"), "text/plain");
  await database.query("update campus_private.resource_objects set preview_text = $2, storage_present = true where resource_id = $1", [resource.id, resourceText]);
  return (await client.update("campus_resources", { id: resource.id }, {
    publisher_name: publisherName,
    visibility: "public",
    upload_state: "ready",
    mime_type: "text/plain",
    byte_size: Buffer.byteLength(resourceText, "utf8"),
    approved_ai: true,
    updated_at: new Date().toISOString(),
  })) ?? resource;
}

async function main() {
  await loadEnvFile(join(repoRoot, ".env"));
  await loadEnvFile(join(repoRoot, ".env.local"));
  const client = new SupabaseRest(configFromEnv());
  const database = process.env.SUPABASE_DB_URL ? new pg.Client({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } }) : null;
  if (database) await database.connect();
  const credentials = await prepareCredentials();
  const users = {};
  const profiles = {};
  const rosters = {};

  for (const spec of showcase.users) {
    users[spec.key] = await ensureAuthUser(client, spec, credentials[spec.key].password);
    profiles[spec.key] = await ensureProfile(client, spec, users[spec.key].id);
    rosters[spec.key] = await ensureRoster(client, spec, users[spec.key].id);
  }

  const organizerId = users.organizer.id;
  const supportId = users.support.id;
  const studentId = users.student.id;
  const club = await ensureClub(client);
  await ensureAssignment(client, organizerId, "club_organizer", "club", club.id);
  const office = await ensureOffice(client, supportId);
  await ensureAssignment(client, supportId, "support_staff", "office", office.id);
  const audience = await ensureAudience(client);
   const article = await ensureArticle(client, audience.id, organizerId, showcase.users[1].fullName);
   const notice = await ensureContent(client, { kind: "notice", title: "CampusOS Showcase Academic Update", body: "This approved synthetic notice keeps the Academic Updates collection ready for the showcase.", category: "Academic updates", noticeType: "general", audienceId: audience.id, publisherId: organizerId, publisherName: showcase.users[1].fullName });
   const service = await ensureContent(client, { kind: "service", title: "CampusOS Showcase Student Service", body: "Use this approved synthetic service record to demonstrate reviewed instructions and a verified destination.", category: "Student services", noticeType: "general", audienceId: audience.id, publisherId: organizerId, publisherName: showcase.users[1].fullName, destinationUrl: "https://example.edu/campus/showcase-service", eligibility: "Current campus users" });
  const directory = await ensureDirectory(client, organizerId);
  const route = await ensureRoute(client, organizerId);
  const event = await ensureEvent(client, club.id);

  const optionalReports = [];
  let item = null;
  try {
    item = await ensureFoundItem(client, studentId);
  } catch (error) {
    optionalReports.push(`Found/lost item and PNG media skipped: ${error instanceof Error ? error.message : "request failed"}.`);
  }
  let resource = null;
  try {
     resource = await ensureResource(client, studentId, showcase.users[0].fullName, database);
  } catch (error) {
    optionalReports.push(`Ready public text resource skipped: ${error instanceof Error ? error.message : "request failed"}.`);
  }

  console.log("CampusOS showcase seed complete; existing rows were reused and no rows were deleted.");
  for (const spec of showcase.users) {
    console.log(`${spec.label}: auth ${users[spec.key].id}, profile ${profiles[spec.key].user_id}, roster ${rosters[spec.key].id}, email ${users[spec.key].email}`);
  }
  console.log(`Club: ${club.id}`);
  console.log(`Support office: ${office.id}`);
  console.log(`Directory: ${directory.id}`);
  console.log(`Transport route: ${route.id}`);
   console.log(`Article: ${article.id}`);
   console.log(`Academic notice: ${notice.id}`);
   console.log(`Service: ${service.id}`);
  console.log(`Campus event: ${event.id}`);
  if (item) console.log(`Found item: ${item.id}`);
  if (resource) console.log(`Text resource: ${resource.id}`);
  console.log(`Credentials file: ${relative(repoRoot, credentialsFile)} (ignored; passwords are not printed).`);
  for (const report of optionalReports) console.log(report);
  if (database) await database.end();
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Showcase seed failed.");
  process.exitCode = 1;
});
