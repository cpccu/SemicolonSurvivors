import "server-only";
import { z } from "zod";
import { checkResult, CommunityFailure, type CommunityClient } from "@/modules/community/server/database";
import { directorySchema, preferencesSchema } from "@/modules/community/models";
import { directoryInput, literalSearch, preferenceInput, type searchSchema } from "@/modules/community/validation";

export async function listDirectory(database: CommunityClient, input: z.infer<typeof searchSchema>, kind?: string) {
  const start = (input.page - 1) * input.limit;
  let query = database.from("community_directory").select("*").eq("state", "published").order("title").order("id").range(start, start + input.limit);
  if (input.query) query = query.ilike("title", literalSearch(input.query));
  if (kind) query = query.eq("kind", kind as z.infer<typeof directoryInput>["kind"]);
  const result = await query; checkResult(result.error);
  const rows = z.array(directorySchema).parse(result.data);
  return { entries: rows.slice(0, input.limit), page: input.page, hasMore: rows.length > input.limit };
}
export async function directoryDetail(database: CommunityClient, id: string) {
  const result = await database.from("community_directory").select("*").eq("id", id).maybeSingle(); checkResult(result.error);
  if (!result.data) throw new CommunityFailure("not_found", 404, "This directory entry is unavailable.");
  return { entry: directorySchema.parse(result.data) };
}
export async function preferences(database: CommunityClient) {
  const user = await database.auth.getUser();
  const result = await database.from("community_preferences").select("*").eq("user_id", user.data.user!.id).maybeSingle(); checkResult(result.error);
  return { preferences: preferencesSchema.nullable().parse(result.data) };
}
export async function savePreferences(database: CommunityClient, input: z.infer<typeof preferenceInput>) {
  const result = await database.rpc("community_save_preferences", { p_data: input }); checkResult(result.error);
  return { preferences: preferencesSchema.parse(result.data) };
}
