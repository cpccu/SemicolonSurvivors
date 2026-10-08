import "server-only";
import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createAdminDatabaseClient } from "@/lib/database/admin";
import { createRequestDatabaseContext } from "@/lib/database/request";
import { ApplicationError, publicError } from "@/lib/observability/errors";
import { configuredSiteOrigin } from "@/lib/security/configuration";
import { activeUser, checkResult, CommunityFailure, communityBudget, type CommunityClient } from "./database";
import { maximumImageBytes, sanitizePng } from "../png";

const bucket = "campus-community";
async function readImage(request: NextRequest) {
  if (request.headers.get("origin") !== configuredSiteOrigin() || request.nextUrl.origin !== configuredSiteOrigin()) throw new ApplicationError("authorization");
  if (request.headers.get("content-type") !== "image/png" || Number(request.headers.get("content-length")) > maximumImageBytes || !request.body) throw new ApplicationError("validation");
  const reader = request.body.getReader(); const chunks: Uint8Array[] = []; let size = 0;
  try {
    while (true) {
      const result = await reader.read(); if (result.done) break;
      size += result.value.byteLength;
      if (size > maximumImageBytes) { await reader.cancel(); throw new ApplicationError("validation"); }
      chunks.push(result.value);
    }
    try { return sanitizePng(Buffer.concat(chunks)); } catch { throw new CommunityFailure("validation", 400, "Use a valid non-interlaced 8-bit RGB/RGBA PNG, up to 3 MiB and 2048 × 2048 pixels."); }
  } finally { reader.releaseLock(); }
}
export async function uploadMedia(request: NextRequest) {
  let finalize: ((response: NextResponse) => NextResponse) | undefined;
  try {
    const context = createRequestDatabaseContext(request); finalize = context.finalizeResponse;
    const database = context.client as unknown as CommunityClient;
    const owner = await activeUser(database); await communityBudget(owner, true);
    const purpose = z.enum(["item", "complaint"]).safeParse(request.headers.get("x-campus-media-purpose"));
    if (!purpose.success) throw new ApplicationError("validation");
    const image = await readImage(request); const id = randomUUID(); const path = `${owner}/${id}.png`;
    const admin = createAdminDatabaseClient() as unknown as CommunityClient;
    const pending = await admin.from("community_media").insert({ id, owner_id: owner, object_path: path, mime_type: "image/png", byte_size: image.length, purpose: purpose.data, state: "pending" }); checkResult(pending.error);
    const uploaded = await admin.storage.from(bucket).upload(path, image, { contentType: "image/png", upsert: false });
    if (uploaded.error) {
      await admin.from("community_media").update({ state: "failed" }).eq("id", id);
      throw new ApplicationError("configuration");
    }
    const ready = await admin.from("community_media").update({ state: "ready" }).eq("id", id).eq("state", "pending").select("id").single();
    if (ready.error) { await admin.storage.from(bucket).remove([path]); checkResult(ready.error); }
    return finalize(NextResponse.json({ mediaId: id, mimeType: "image/png", byteSize: image.length, metadataRemoved: true }, { status: 201, headers: { "Cache-Control": "private, no-store" } }));
  } catch (error) { return mediaError(error, finalize); }
}
function mediaError(error: unknown, finalize?: (response: NextResponse) => NextResponse) {
  const failure = error instanceof CommunityFailure ? error : publicError(error);
  const response = NextResponse.json({ error: { code: failure.code, message: failure.message } }, { status: failure.status, headers: { "Cache-Control": "private, no-store" } });
  return finalize ? finalize(response) : response;
}
export async function downloadMedia(request: NextRequest, id: string) {
  let finalize: ((response: NextResponse) => NextResponse) | undefined;
  try {
    if (!z.uuid().safeParse(id).success) throw new ApplicationError("validation");
    const context = createRequestDatabaseContext(request); finalize = context.finalizeResponse;
    const database = context.client as unknown as CommunityClient; await activeUser(database);
    // Recheck current entity authorization on every download; no long-lived signed URL escapes suspension.
    const access = await database.rpc("community_media_access", { p_id: id }); checkResult(access.error);
    const media = z.object({ objectPath: z.string(), mimeType: z.literal("image/png"), byteSize: z.number().int().max(maximumImageBytes) }).parse(access.data);
    const result = await createAdminDatabaseClient().storage.from(bucket).download(media.objectPath);
    if (result.error || !result.data || result.data.size !== media.byteSize) throw new CommunityFailure("not_found", 404, "This image is unavailable.");
    return finalize(new NextResponse(result.data, { headers: { "Content-Type": "image/png", "Content-Disposition": `inline; filename="${id}.png"`, "X-Content-Type-Options": "nosniff", "Cache-Control": "private, no-store" } }));
  } catch (error) { return mediaError(error, finalize); }
}
