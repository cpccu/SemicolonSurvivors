"use client";

import { createBrowserClient } from "@supabase/ssr";
import { ApplicationError } from "@/lib/observability/errors";
import { readBackendConfiguration } from "@/lib/validation/environment";
import type { CampusDatabase } from "@/lib/database/schema";

export function createBrowserAuthClient() {
  const result = readBackendConfiguration({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    NODE_ENV: process.env.NODE_ENV,
  });
  if (result.status !== "ready") throw new ApplicationError("configuration");

  return createBrowserClient<CampusDatabase>(result.config.url, result.config.publishableKey, {
    auth: { detectSessionInUrl: false },
    cookieOptions: { path: "/", sameSite: "lax", secure: process.env.NODE_ENV === "production" },
  });
}
