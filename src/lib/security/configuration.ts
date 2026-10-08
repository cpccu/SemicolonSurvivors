import "server-only";
import { ApplicationError } from "@/lib/observability/errors";

export function configuredSiteOrigin(): string {
  try {
    const raw = process.env.CAMPUS_SITE_URL;
    if (!raw || raw.length > 2048) throw new Error("missing");
    const url = new URL(raw);
    const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
    const secure = url.protocol === "https:" || (process.env.NODE_ENV !== "production" && local && url.protocol === "http:");
    if (!secure || url.username || url.password || url.search || url.hash || url.pathname !== "/") throw new Error("invalid");
    return url.origin;
  } catch {
    throw new ApplicationError("configuration");
  }
}

export function emailRolloutEnabled(): boolean {
  return process.env.CAMPUS_AUTH_EMAIL_ENABLED === "true" && process.env.CAMPUS_SMTP_VERIFIED === "true";
}

export function requireEmailRollout() {
  if (!emailRolloutEnabled()) throw new ApplicationError("configuration");
  return `${configuredSiteOrigin()}/auth/confirm`;
}

export function enrollmentScopeId(): string {
  const id = process.env.CAMPUS_INSTITUTION_ID;
  if (!id || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
    throw new ApplicationError("configuration");
  }
  return id;
}
