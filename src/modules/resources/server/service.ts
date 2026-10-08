import "server-only";
import { z } from "zod";
import { ApplicationError } from "@/lib/observability/errors";
import { resourceMetadataSchema, resourcePageSchema, resourceRowSchema, resourceQuerySchema, previewSchema } from "../models";
import { checkDatabase, parseContent, type ContentContext } from "@/modules/content/server/http";
import { capabilities, searchPattern } from "@/modules/content/server/service";
import { enforceContentRate } from "@/modules/content/server/rate";
import { contentAdmin, storageRecord, RESOURCE_BUCKET } from "./upload";

export async function listResources(context: ContentContext, input: unknown) {
  const query = parseContent(resourceQuerySchema, input);
  let request = context.database.from("campus_resources").select("*");
  if (query.mine === "true") {
    if (!context.actor) throw new ApplicationError("authentication");
    request = request.eq("owner_id", context.actor.userId);
  } else if (query.review === "true") {
    if (context.actor?.assurance !== "aal2" || !(await capabilities(context)).moderatorScopes.length) throw new ApplicationError("authorization");
    request = request.neq("visibility", "private");
  } else request = request.eq("upload_state", "ready");
  if (query.q) request = request.or(`title.ilike.${searchPattern(query.q)},description.ilike.${searchPattern(query.q)}`);
  for (const field of ["department", "course", "semester", "category"] as const) if (query[field]) request = request.eq(field, query[field]!);
  const result = await request.order("updated_at", { ascending: false }).order("id").range(query.offset, query.offset + 20);
  checkDatabase(result.error);
  return parseContent(resourcePageSchema, { items: (result.data ?? []).slice(0, 20), nextOffset: (result.data?.length ?? 0) > 20 ? query.offset + 20 : null });
}
export async function getResource(context: ContentContext, id: string) {
  const result = await context.database.from("campus_resources").select("*").eq("id", parseContent(z.uuid(), id)).maybeSingle();
  checkDatabase(result.error);
  if (!result.data) throw new ApplicationError("authorization");
  return parseContent(resourceRowSchema, result.data);
}
export async function updateResource(context: ContentContext, id: string, input: unknown) {
  const body = parseContent(z.strictObject({ metadata: resourceMetadataSchema, expectedVersion: z.number().int().positive() }), input);
  const result = await context.database.rpc("resource_update", { p_id: parseContent(z.uuid(), id), p_expected_version: body.expectedVersion, p_metadata: body.metadata });
  checkDatabase(result.error);
  return { item: parseContent(resourceRowSchema, result.data) };
}
export async function resourcePreview(context: ContentContext, id: string) {
  const result = await context.database.rpc("resource_preview", { p_id: parseContent(z.uuid(), id) });
  checkDatabase(result.error);
  return parseContent(previewSchema, result.data);
}
export async function downloadResource(context: ContentContext, id: string) {
  const resource = await getResource(context, id);
  if (resource.upload_state !== "ready") throw new ApplicationError("authorization");
  const record = await storageRecord(id, context.actor.userId);
  const result = await contentAdmin().storage.from(RESOURCE_BUCKET).createSignedUrl(record.path, 60, { download: `resource-${id}.${resource.mime_type === "text/plain" ? "txt" : "pdf"}` });
  if (result.error || !result.data) throw new ApplicationError("configuration");
  return { url: result.data.signedUrl, expiresIn: 60 };
}
export async function reconcileResource(context: ContentContext, id: string) {
  const resource = await getResource(context, id);
  if (!context.actor || (resource.owner_id !== context.actor.userId && !(await capabilities(context)).moderatorScopes.length)) throw new ApplicationError("authorization");
  if (resource.owner_id !== context.actor.userId && context.actor.assurance !== "aal2") throw new ApplicationError("authorization");
  if (resource.upload_state === "ready" || (resource.upload_state === "pending" && Date.parse(resource.created_at) > Date.now() - 600000)) throw new ApplicationError("conflict");
  const record = await storageRecord(id, context.actor.userId);
  const admin = contentAdmin();
  const marked = await admin.rpc("resource_storage_outcome", { p_id: id, p_actor_id: context.actor.userId, p_outcome: "cleanup_pending" });
  checkDatabase(marked.error);
  const result = await admin.storage.from(RESOURCE_BUCKET).remove([record.path]);
  if (result.error) throw new ApplicationError("configuration");
  const outcome = await admin.rpc("resource_storage_outcome", { p_id: id, p_actor_id: context.actor.userId, p_outcome: "cleaned" });
  checkDatabase(outcome.error);
  return { item: await getResource(context, id) };
}
export async function resourceAction(context: ContentContext, id: string, input: unknown) {
  if (!context.actor) throw new ApplicationError("authentication");
  await enforceContentRate("resource-action", context.actor.userId);
  const action = parseContent(z.discriminatedUnion("action", [
    z.strictObject({ action: z.literal("report"), reason: z.string().trim().min(3).max(1000) }),
    z.strictObject({ action: z.literal("remove"), expectedVersion: z.number().int().positive() }),
    z.strictObject({ action: z.literal("reconcile") }),
    z.strictObject({ action: z.literal("review"), scopeId: z.uuid(), decision: z.enum(["remove", "approve_ai", "dismiss"]), reason: z.string().trim().min(3).max(500) }),
  ]), input);
  parseContent(z.uuid(), id);
  if (action.action === "reconcile") return reconcileResource(context, id);
  if (action.action === "report") {
    const result = await context.database.rpc("resource_report", { p_id: id, p_reason: action.reason });
    checkDatabase(result.error); return { reported: true };
  }
  const result = action.action === "remove"
    ? await context.database.rpc("resource_remove", { p_id: id, p_expected_version: action.expectedVersion })
    : await context.database.rpc("resource_review", { p_id: id, p_scope_id: action.scopeId, p_action: action.decision, p_reason: action.reason });
  checkDatabase(result.error);
  const item = parseContent(resourceRowSchema, result.data);
  // Removal is durable even when object deletion fails; the UI offers an explicit retry.
  if (item.upload_state === "cleanup_pending") {
    try { return await reconcileResource(context, id); } catch { return { item, cleanupRequired: true }; }
  }
  return { item };
}
