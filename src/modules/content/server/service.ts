import "server-only";
import { z } from "zod";
import { ApplicationError } from "@/lib/observability/errors";
import { authorizeScopedOperation } from "@/lib/authorization/policies";
import { contentInputSchema, contentRowSchema, contentPageSchema, capabilitiesSchema, revisionSchema, listQuerySchema, type ContentKind } from "../models";
import type { ContentJson } from "../db-types";
import { checkDatabase, parseContent, type ContentContext } from "./http";
import { enforceContentRate } from "./rate";

export function searchPattern(query: string) {
  return `%${query.replace(/[%,_().\\]/g, " ").replace(/\s+/g, " ").trim()}%`;
}
export async function capabilities({ database }: ContentContext) {
  const result = await database.rpc("content_capabilities", {});
  checkDatabase(result.error);
  return parseContent(capabilitiesSchema, result.data);
}
export async function listContent(context: ContentContext, kind: ContentKind, input: unknown) {
  const query = parseContent(listQuerySchema, input);
  let request = context.database.from("campus_content").select("*").eq("kind", kind);
  if (query.manage === "true") {
    if (!context.actor || context.actor.assurance !== "aal2") throw new ApplicationError("authorization");
    const allowed = (await capabilities(context)).publishAudiences.map((audience) => audience.id);
    if (!allowed.length) return { items: [], nextOffset: null };
    request = request.in("audience_id", allowed);
  } else request = request.eq("status", "published").or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`);
  if (query.q) request = request.or(`title.ilike.${searchPattern(query.q)},body.ilike.${searchPattern(query.q)}`);
  if (query.audience) request = request.eq("audience_id", query.audience);
  if (query.category) request = request.eq("category", query.category);
  const result = await request.order("updated_at", { ascending: false }).order("id").range(query.offset, query.offset + 20);
  checkDatabase(result.error);
  return parseContent(contentPageSchema, { items: (result.data ?? []).slice(0, 20), nextOffset: (result.data?.length ?? 0) > 20 ? query.offset + 20 : null });
}
export async function getContent(context: ContentContext, kind: ContentKind, id: string) {
  const result = await context.database.from("campus_content").select("*").eq("kind", kind).eq("id", parseContent(z.uuid(), id)).maybeSingle();
  checkDatabase(result.error);
  if (!result.data) throw new ApplicationError("authorization");
  const revisions = await context.database.from("content_revisions").select("*").eq("content_id", id).order("version", { ascending: false }).limit(20);
  checkDatabase(revisions.error);
  return { item: parseContent(contentRowSchema, result.data), revisions: parseContent(z.array(revisionSchema), revisions.data) };
}
export async function saveContent(context: ContentContext, kind: ContentKind, input: unknown, id: string | null = null) {
  const body = parseContent(z.strictObject({ content: contentInputSchema, expectedVersion: z.number().int().positive().nullable() }), input);
  if (body.content.kind !== kind) throw new ApplicationError("validation");
  const audience = (await capabilities(context)).publishAudiences.find((candidate) => candidate.id === body.content.audienceId);
  if (!audience || !authorizeScopedOperation(context.actor, "publish_notice", { kind: audience.kind, id: audience.id }).allowed) {
    throw new ApplicationError("authorization");
  }
  await enforceContentRate("publish", context.actor!.userId);
  const result = await context.database.rpc("content_save", {
    p_id: id ? parseContent(z.uuid(), id) : null, p_expected_version: body.expectedVersion, p_input: body.content as ContentJson,
  });
  checkDatabase(result.error);
  return { item: parseContent(contentRowSchema, result.data) };
}
export async function archiveContent(context: ContentContext, kind: ContentKind, id: string, input: unknown) {
  if (!context.actor) throw new ApplicationError("authentication");
  await enforceContentRate("publish", context.actor.userId);
  await getContent(context, kind, id);
  const body = parseContent(z.strictObject({ expectedVersion: z.number().int().positive() }), input);
  const result = await context.database.rpc("content_delete", { p_id: id, p_expected_version: body.expectedVersion });
  checkDatabase(result.error);
  return { item: parseContent(contentRowSchema, result.data) };
}
