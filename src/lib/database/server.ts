import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { requireBackendConfiguration } from "./configuration";
import type { CampusDatabase } from "./schema";

export async function createServerDatabaseClient() {
  const configuration = requireBackendConfiguration();
  const cookieStore = await cookies();

  // Read-only renders rely on an auth request boundary to persist refreshed cookies.
  return createServerClient<CampusDatabase>(configuration.url, configuration.publishableKey, {
    cookieOptions: { path: "/", sameSite: "lax", secure: process.env.NODE_ENV === "production" },
    cookies: { getAll: () => cookieStore.getAll() },
  });
}
