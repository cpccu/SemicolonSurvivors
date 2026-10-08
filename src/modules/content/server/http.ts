import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { createRequestDatabaseContext } from "@/lib/database/request";
import type { CampusDatabase } from "@/lib/database/schema";
import { getRequestActor } from "@/lib/auth/request-actor";
import { ApplicationError, publicError } from "@/lib/observability/errors";
import { readBoundedJson } from "@/lib/security/request";
import { configuredSiteOrigin } from "@/lib/security/configuration";
import type { AuthorizationActor } from "@/lib/authorization/models";
import type { ContentFunctions, ContentTables } from "../db-types";

type ContentDatabase = { public: {
  Tables: CampusDatabase["public"]["Tables"] & ContentTables;
  Functions: CampusDatabase["public"]["Functions"] & ContentFunctions;
  Views: Record<string, never>; Enums: Record<string, never>; CompositeTypes: Record<string, never>;
} };
export type ContentClient = SupabaseClient<ContentDatabase>;
export type ContentContext = { database: ContentClient; actor: AuthorizationActor };

export function parseContent<T>(schema: z.ZodType<T>, input: unknown): T {
  const parsed = schema.safeParse(input);
  if (!parsed.success) throw new ApplicationError("validation");
  return parsed.data;
}
export function checkDatabase(error: { code?: string; message?: string } | null) {
  if (!error) return;
  if (error.code === "42501") throw new ApplicationError("authorization");
  if (["23505", "40001"].includes(error.code ?? "")) throw new ApplicationError("conflict");
  if (["22023", "22P02", "23514", "23502", "22007", "22008"].includes(error.code ?? "")) throw new ApplicationError("validation");
  if (error.message === "quota") throw new ApplicationError("quota");
  throw new ApplicationError("configuration");
}
export function assertContentOrigin(request: NextRequest) {
  const origin = configuredSiteOrigin();
  if (request.headers.get("origin") !== origin || request.nextUrl.origin !== origin
    || request.headers.get("sec-fetch-site") === "cross-site") throw new ApplicationError("authorization");
}
export function readContentBody(request: NextRequest) { return readBoundedJson(request, z.unknown(), 24000); }
export async function contentResponse(request: NextRequest, handler: (context: ContentContext) => Promise<unknown>, write = false) {
  let finalize: ((response: NextResponse) => NextResponse) | undefined;
  try {
    if (write) assertContentOrigin(request);
    const context = createRequestDatabaseContext(request);
    finalize = context.finalizeResponse;
    // Campus reads require the same verified, active account as writes.
    const actor = await getRequestActor(context.client);
    // The module contract is composed by the root schema; this boundary also supports parallel implementation.
    const database = context.client as unknown as ContentClient;
    return finalize(NextResponse.json(await handler({ database, actor })));
  } catch (error) {
    const failure = publicError(error);
    const response = NextResponse.json({ error: { code: failure.code, message: failure.message } }, {
      status: failure.status, headers: { "Cache-Control": "private, no-store" },
    });
    return finalize ? finalize(response) : response;
  }
}
