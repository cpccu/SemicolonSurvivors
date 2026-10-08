import { createServer } from "node:https";
import { createHmac, timingSafeEqual } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { execFileSync, spawn } from "node:child_process";
import { join } from "node:path";

// Isolated synthetic Auth/REST transport, not a production auth bypass or hosted test.
const directory = await mkdtemp("/tmp/omnirush/campusos-browser-");
const cert = join(directory, "certificate.pem");
const key = join(directory, "key.pem");
execFileSync("openssl", ["req", "-x509", "-newkey", "rsa:2048", "-nodes", "-days", "1",
  "-keyout", key, "-out", cert, "-subj", "/CN=127.0.0.1", "-addext", "subjectAltName=IP:127.0.0.1"], { stdio: "ignore" });
const userId = "00000000-0000-4000-8000-000000000001";
const signingKey = "synthetic-browser-fixture-signing-key";
const user = { id: userId, aud: "authenticated", role: "authenticated", email: "browser@example.invalid",
  email_confirmed_at: "2026-10-08T00:00:00Z", created_at: "2026-10-08T00:00:00Z", app_metadata: {}, user_metadata: {}, factors: [] };
function verified(headers) {
  try {
    const token = headers.authorization?.replace(/^Bearer /, "") ?? "";
    const [head, body, signature] = token.split(".");
    const expected = createHmac("sha256", signingKey).update(`${head}.${body}`).digest("base64url");
    if (!signature || signature.length !== expected.length || !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return false;
    const claims = JSON.parse(Buffer.from(body, "base64url").toString());
    return claims.sub === userId && claims.exp > Date.now() / 1000;
  } catch { return false; }
}
const backend = createServer({ cert: await readFile(cert), key: await readFile(key) }, (request, response) => {
  const path = new URL(request.url, "https://127.0.0.1:3201").pathname;
  response.setHeader("Content-Type", "application/json");
  const send = (value, status = 200) => { response.statusCode = status; response.end(JSON.stringify(value)); };
  if (path === "/rest/v1/rpc/identity_health" && request.headers.apikey === "sb_secret_synthetic_browser_fixture_123456") return send("202610070001");
  if (!verified(request.headers)) return send({ code: "not_authenticated", message: "Synthetic missing session" }, 401);
  if (path === "/auth/v1/user") return send(user);
  if (path === "/auth/v1/logout") return send({});
  if (path === "/rest/v1/rpc/campus_access") return send({ userId, status: "active", assignments: [] });
  if (path === "/rest/v1/profiles") return send({ full_name: "Synthetic Browser Test", status: "active", user_id: userId });
  if (path === "/rest/v1/rpc/consume_rate_limit") return send(true);
  if (path === "/rest/v1/rpc/content_capabilities") return send({ publishAudiences: [], moderatorScopes: [] });
  if (path === "/rest/v1/rpc/event_organizer_capabilities") return send({ clubs: [], events: [] });
  if (path.startsWith("/rest/v1/")) return send([]);
  return send({ message: "Unsupported synthetic operation" }, 404);
});
await new Promise((resolve) => backend.listen(3201, "127.0.0.1", resolve));
const next = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1", "--port", "3100"], {
  stdio: "inherit", env: { ...process.env, NODE_EXTRA_CA_CERTS: cert,
    NEXT_PUBLIC_SUPABASE_URL: "https://127.0.0.1:3201", NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_synthetic_browser_fixture_123456",
    SUPABASE_SECRET_KEY: "sb_secret_synthetic_browser_fixture_123456", CAMPUS_SITE_URL: "https://127.0.0.1:3100/",
    CAMPUS_E2E_PREVIEW: "false", CAMPUS_AUTH_EMAIL_ENABLED: "false", CAMPUS_SMTP_VERIFIED: "false", CAMPUS_AI_ENABLED: "false" },
});
let stopping = false;
async function stop() {
  if (stopping) return;
  stopping = true; next.kill("SIGTERM"); backend.close();
  await rm(directory, { recursive: true, force: true });
}
process.on("SIGTERM", () => void stop());
process.on("SIGINT", () => void stop());
next.on("exit", (code) => { void stop().then(() => process.exit(code ?? 0)); });
