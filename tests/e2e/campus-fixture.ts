import { createHmac } from "node:crypto";
import type { BrowserContext } from "@playwright/test";

// The isolated fixture verifies this synthetic token; real Supabase never receives it.
export async function signInFixture(context: BrowserContext) {
  const userId = "00000000-0000-4000-8000-000000000001";
  const expires = Math.floor(Date.now() / 1000) + 3600;
  const head = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const body = Buffer.from(JSON.stringify({ sub: userId, exp: expires, iat: expires - 3600, aud: "authenticated", role: "authenticated", aal: "aal1", amr: [] })).toString("base64url");
  const signature = createHmac("sha256", "synthetic-browser-fixture-signing-key").update(`${head}.${body}`).digest("base64url");
  const value = "base64-" + Buffer.from(JSON.stringify({ access_token: `${head}.${body}.${signature}`, refresh_token: "synthetic-refresh-token", token_type: "bearer", expires_in: 3600, expires_at: expires, user: { id: userId } })).toString("base64url");
  await context.addCookies([{ name: "sb-127-auth-token", value, domain: "127.0.0.1", path: "/", httpOnly: false, secure: false, sameSite: "Lax" }]);
}
