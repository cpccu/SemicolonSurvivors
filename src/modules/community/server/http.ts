import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createRequestDatabaseContext } from "@/lib/database/request";
import { ApplicationError, publicError } from "@/lib/observability/errors";
import { assertSameOriginJson, readBoundedJson } from "@/lib/security/request";
import { activeUser, CommunityFailure, communityBudget, type CommunityClient } from "./database";

export function parse<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success) throw new ApplicationError("validation");
  return result.data;
}
export function body<T>(request: NextRequest, schema: z.ZodType<T>) { return readBoundedJson(request, schema, 32_768); }
export function params(request: NextRequest) { return Object.fromEntries(request.nextUrl.searchParams); }
export async function respond(request: NextRequest, handler: (database: CommunityClient) => Promise<unknown>, options: { write?: boolean; member?: boolean } = {}) {
  let finalize: ((response: NextResponse) => NextResponse) | undefined;
  try {
    if (options.write) assertSameOriginJson(request);
    const context = createRequestDatabaseContext(request); finalize = context.finalizeResponse;
    // Module contract remains independently typed while the main session composes the shared schema.
    const database = context.client as unknown as CommunityClient;
    // Directory and transport reads are campus content too.
    const id = await activeUser(database);
    if (options.write) await communityBudget(id);
    return finalize(NextResponse.json(await handler(database), { headers: { "Cache-Control": "private, no-store" } }));
  } catch (error) {
    const failure = error instanceof CommunityFailure ? error : publicError(error);
    const response = NextResponse.json({ error: { code: failure.code, message: failure.message } }, { status: failure.status, headers: { "Cache-Control": "private, no-store" } });
    return finalize ? finalize(response) : response;
  }
}
