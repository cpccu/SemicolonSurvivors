import "server-only";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { type NextRequest, type NextResponse } from "next/server";
import { requireBackendConfiguration } from "./configuration";
import type { CampusDatabase } from "./schema";

type CookieUpdate = { name: string; value: string; options: CookieOptions };

export function createRequestDatabaseContext(request: NextRequest) {
  const configuration = requireBackendConfiguration();
  const pendingCookies = new Map<string, CookieUpdate>();
  const pendingHeaders = new Map<string, string>();
  const client = createServerClient<CampusDatabase>(configuration.url, configuration.publishableKey, {
    cookieOptions: { path: "/", sameSite: "lax", secure: process.env.NODE_ENV === "production" },
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(updates, headers) {
        for (const update of updates) {
          request.cookies.set(update.name, update.value);
          pendingCookies.set(update.name, update);
        }
        for (const [name, value] of Object.entries(headers)) pendingHeaders.set(name, value);
      },
    },
  });

  function finalizeResponse<T extends NextResponse>(response: T): T {
    for (const { name, value, options } of pendingCookies.values()) response.cookies.set(name, value, options);
    for (const [name, value] of pendingHeaders) response.headers.set(name, value);
    // Authenticated responses must remain private even when no token refresh occurred.
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  }

  return { client, finalizeResponse };
}
