import "server-only";
import { z } from "zod";
import type { NextRequest } from "next/server";
import { ApplicationError } from "@/lib/observability/errors";
import { createAdminDatabaseClient } from "@/lib/database/admin";
import { resourceMetadataSchema, resourceRowSchema, MAX_UPLOAD_BYTES } from "../models";
import { validateUpload } from "../upload-validation";
import { checkDatabase, parseContent, type ContentClient, type ContentContext } from "@/modules/content/server/http";
import { enforceContentRate } from "@/modules/content/server/rate";

export const RESOURCE_BUCKET = "campus-resources";
export const storageRecordSchema = z.strictObject({
  path: z.string().regex(/^[0-9a-f-]{36}\/[0-9a-f-]{36}\.(txt|pdf)$/),
  expectedMime: z.enum(["text/plain", "application/pdf"]), state: resourceRowSchema.shape.upload_state,
  ownerId: z.uuid(), storagePresent: z.boolean(),
});
export function contentAdmin() { return createAdminDatabaseClient() as unknown as ContentClient; }
export async function storageRecord(id: string, actorId: string | null) {
  const result = await contentAdmin().rpc("resource_storage_record", { p_id: id, p_actor_id: actorId });
  checkDatabase(result.error);
  return parseContent(storageRecordSchema, result.data);
}
async function boundedMultipart(request: NextRequest): Promise<FormData> {
  const type = request.headers.get("content-type") ?? "";
  const maximum = MAX_UPLOAD_BYTES + 24000;
  if (!type.startsWith("multipart/form-data;") || !request.body || Number(request.headers.get("content-length")) > maximum) throw new ApplicationError("validation");
  const reader = request.body.getReader();
  const parts: Uint8Array[] = []; let size = 0;
  try {
    while (true) {
      const chunk = await reader.read(); if (chunk.done) break;
      size += chunk.value.byteLength;
      if (size > maximum) { await reader.cancel(); throw new ApplicationError("validation"); }
      parts.push(chunk.value);
    }
    const bytes = new Uint8Array(size); let offset = 0;
    for (const part of parts) { bytes.set(part, offset); offset += part.byteLength; }
    return await new Request(request.url, { method: "POST", headers: { "content-type": type }, body: bytes }).formData();
  } catch (error) { if (error instanceof ApplicationError) throw error; throw new ApplicationError("validation"); }
  finally { reader.releaseLock(); }
}
export async function uploadResource(context: ContentContext, request: NextRequest) {
  if (!context.actor) throw new ApplicationError("authentication");
  await enforceContentRate("upload", context.actor.userId);
  const form = await boundedMultipart(request);
  if ([...form.keys()].length !== 2 || form.getAll("file").length !== 1 || form.getAll("metadata").length !== 1) throw new ApplicationError("validation");
  const file = form.get("file"); const metadata = form.get("metadata");
  if (!(file instanceof File) || typeof metadata !== "string" || metadata.length > 12000) throw new ApplicationError("validation");
  let input: unknown;
  try { input = JSON.parse(metadata); } catch { throw new ApplicationError("validation"); }
  const validMetadata = parseContent(resourceMetadataSchema, input);
  let validated: ReturnType<typeof validateUpload>;
  try { validated = validateUpload(new Uint8Array(await file.arrayBuffer()), file.type, file.name); }
  catch { throw new ApplicationError("validation"); }
  const pending = await context.database.rpc("resource_begin", { p_metadata: { ...validMetadata, mimeType: validated.mime } });
  checkDatabase(pending.error);
  const resource = parseContent(resourceRowSchema, pending.data);
  const admin = contentAdmin();
  const record = await storageRecord(resource.id, context.actor.userId);
  try {
    const uploaded = await admin.storage.from(RESOURCE_BUCKET).upload(record.path, validated.bytes, { contentType: validated.mime, upsert: false });
    if (uploaded.error) throw new ApplicationError("configuration");
    const finalized = await admin.rpc("resource_finish", { p_id: resource.id, p_actor_id: context.actor.userId,
      p_size: validated.bytes.byteLength, p_mime: validated.mime, p_text: validated.text });
    checkDatabase(finalized.error);
    return { item: parseContent(resourceRowSchema, finalized.data) };
  } catch (error) {
    // Finalization can be uncertain: re-read before deleting a successfully committed file.
    try {
      const current = await storageRecord(resource.id, context.actor.userId);
      if (current.state !== "ready") {
        const marked = await admin.rpc("resource_storage_outcome", { p_id: resource.id, p_actor_id: context.actor.userId, p_outcome: "cleanup_pending" });
        if (!marked.error) {
          const removed = await admin.storage.from(RESOURCE_BUCKET).remove([record.path]);
          if (!removed.error) await admin.rpc("resource_storage_outcome", { p_id: resource.id, p_actor_id: context.actor.userId, p_outcome: "cleaned" });
        }
      }
    } catch { /* Pending metadata remains available for explicit reconciliation. */ }
    throw error;
  }
}
