import "server-only";
import { z } from "zod";
import { enrollmentScopeId } from "@/lib/security/configuration";
import { checkResult, type CommunityClient } from "@/modules/community/server/database";
import { directorySchema, officeSchema, routeSchema } from "@/modules/community/models";
import { adminInput, directoryInput, officeInput, publishInput, routeInput } from "@/modules/community/validation";
import { administrationClubInput, administrationLookupInput } from "../validation";

export const administrationProfileSchema = z.object({
  userId: z.uuid(),
  fullName: z.string().min(2).max(120),
  studentId: z.string().nullable(),
  department: z.string().nullable(),
});
export const administrationClubSchema = z.object({
  id: z.uuid(),
  name: z.string().min(2).max(160),
  description: z.string().max(5000),
  created_at: z.string(),
});
export const administrationLookupSchema = z.object({
  profiles: z.array(administrationProfileSchema).max(25),
  clubs: z.array(administrationClubSchema).max(100),
});

export async function capabilities(database: CommunityClient) {
  const result = await database.rpc("campus_access", {}); checkResult(result.error);
  const [directory, routes] = await Promise.all([
    database.from("community_directory").select("*").neq("state", "published").order("updated_at", { ascending: false }).limit(30),
    database.from("community_routes").select("*").neq("state", "published").order("updated_at", { ascending: false }).limit(30),
  ]); checkResult(directory.error); checkResult(routes.error);
  return { access: result.data, institutionId: enrollmentScopeId(), directoryDrafts: z.array(directorySchema).parse(directory.data), routeDrafts: z.array(routeSchema).parse(routes.data) };
}
export async function publishDirectory(database: CommunityClient, input: z.infer<ReturnType<typeof publishInput<typeof directoryInput>>>) {
  const result = await database.rpc("community_publish_directory", { p_id: input.id, p_version: input.version, p_data: input.data }); checkResult(result.error);
  return { entry: directorySchema.parse(result.data) };
}
export async function publishRoute(database: CommunityClient, input: z.infer<ReturnType<typeof publishInput<typeof routeInput>>>) {
  const result = await database.rpc("community_publish_route", { p_id: input.id, p_version: input.version, p_data: input.data }); checkResult(result.error);
  return { route: routeSchema.parse(result.data) };
}
export async function adminChange(database: CommunityClient, input: z.infer<typeof adminInput>) {
  const result = await database.rpc("community_admin_change", { p_scope_id: enrollmentScopeId(), p_user_id: input.targetUserId, p_action: input.action, p_data: input.data, p_reason: input.reason }); checkResult(result.error);
  return z.object({ applied: z.literal(true), targetUserId: z.uuid(), action: z.string() }).parse(result.data);
}
export async function officeChange(database: CommunityClient, input: z.infer<typeof officeInput>) {
  const result = await database.rpc("community_admin_office", { p_id: input.id, p_title: input.title, p_description: input.description, p_staff_id: input.staffId, p_active: input.active }); checkResult(result.error);
  return { office: officeSchema.parse(result.data) };
}

export async function administrationLookup(database: CommunityClient, input: z.infer<typeof administrationLookupInput>) {
  const result = await database.rpc("administration_lookup", { p_scope_id: enrollmentScopeId(), p_query: input.query });
  checkResult(result.error);
  return administrationLookupSchema.parse(result.data);
}

export async function administrationCreateClub(database: CommunityClient, input: z.infer<typeof administrationClubInput>) {
  const result = await database.rpc("administration_create_club", {
    p_scope_id: enrollmentScopeId(), p_name: input.name, p_description: input.description,
  });
  checkResult(result.error);
  return { club: administrationClubSchema.parse(result.data) };
}
