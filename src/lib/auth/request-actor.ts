import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { CampusDatabase } from "@/lib/database/schema";
import { databaseAccessRepository } from "@/modules/identity/repository";
import { requireAuthorizationActor } from "./access";

export function getRequestActor(client: SupabaseClient<CampusDatabase>) {
  return requireAuthorizationActor(databaseAccessRepository(client), client);
}
