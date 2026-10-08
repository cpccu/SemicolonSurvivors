import "server-only";
import { z } from "zod";
import { checkResult, CommunityFailure, type CommunityClient } from "@/modules/community/server/database";
import { claimSchema, itemSchema } from "@/modules/community/models";
import { literalSearch, type itemInput, type itemTransitionInput, type searchSchema } from "@/modules/community/validation";
import { suggestMatches } from "../matching";

export async function listItems(database: CommunityClient, input: z.infer<typeof searchSchema>, kind?: string) {
  const start = (input.page - 1) * input.limit;
  let query = database.from("community_items").select("*").in("state", ["open", "handover", "resolved"]).order("created_at", { ascending: false }).order("id").range(start, start + input.limit);
  if (input.query) query = query.ilike("title", literalSearch(input.query));
  if (kind) query = query.eq("kind", kind as "lost" | "found");
  const result = await query; checkResult(result.error);
  const rows = z.array(itemSchema).parse(result.data);
  return { items: rows.slice(0, input.limit), page: input.page, hasMore: rows.length > input.limit };
}
export async function itemDetail(database: CommunityClient, id: string) {
  const result = await database.from("community_items").select("*").eq("id", id).maybeSingle(); checkResult(result.error);
  if (!result.data) throw new CommunityFailure("not_found", 404, "This item is unavailable.");
  const item = itemSchema.parse(result.data);
  const claims = await database.from("community_claims").select("*").eq("item_id", id).order("created_at").limit(50); checkResult(claims.error);
  const candidates = await database.from("community_items").select("*").eq("state", "open").neq("kind", item.kind).order("created_at", { ascending: false }).limit(100); checkResult(candidates.error);
  return { item, claims: z.array(claimSchema).parse(claims.data), suggestions: suggestMatches(item, z.array(itemSchema).parse(candidates.data)), suggestionMethod: "Description words, exact reported location, and date proximity; latest 100 opposite-kind open posts. Suggestions are not proof of ownership." };
}
export async function createItem(database: CommunityClient, input: z.infer<typeof itemInput>) {
  const result = await database.rpc("community_create_item", { p_data: input }); checkResult(result.error);
  return { item: itemSchema.parse(result.data) };
}
export async function claimItem(database: CommunityClient, id: string, evidence: string) {
  const result = await database.rpc("community_claim_item", { p_item_id: id, p_evidence: evidence }); checkResult(result.error);
  return { claim: claimSchema.parse(result.data) };
}
export async function transitionItem(database: CommunityClient, id: string, input: z.infer<typeof itemTransitionInput>) {
  const result = await database.rpc("community_item_transition", { p_item_id: id, p_version: input.version, p_action: input.action, p_claim_id: input.claimId ?? null }); checkResult(result.error);
  return { item: itemSchema.parse(result.data) };
}
