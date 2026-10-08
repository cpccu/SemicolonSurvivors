import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createRequestDatabaseContext } from "@/lib/database/request";
import { ApplicationError, publicError } from "@/lib/observability/errors";
import { assertSameOriginJson, readBoundedJson } from "@/lib/security/request";
import { isSameOrigin } from "../validation";
import { EventFailure, requireActiveMember, type EventClient } from "./service";

const maximumBodyBytes = 16_384;
export function parseInput<T>(schema: z.ZodType<T>, value: unknown): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success) throw new ApplicationError("validation");
  return parsed.data;
}

export async function readEventBody(request: NextRequest): Promise<unknown> {
  return readBoundedJson(request, z.unknown(), maximumBodyBytes);
}

export async function eventResponse(
  request: NextRequest,
  handler: (database: EventClient) => Promise<unknown>,
  options: { write?: boolean; member?: boolean } = {},
) {
  let finalize: ((response: NextResponse) => NextResponse) | undefined;
  try {
    if (options.write && !isSameOrigin(request.headers.get("origin"), request.url, request.headers.get("sec-fetch-site"))) {
      throw new ApplicationError("authorization");
    }
    if (options.write) assertSameOriginJson(request);
    const context = createRequestDatabaseContext(request);
    finalize = context.finalizeResponse;
    // A single typed boundary keeps this migration's contract independent during schema composition.
    const database = context.client as unknown as EventClient;
    // Public visibility is discoverability inside CampusOS, not anonymous access.
    await requireActiveMember(database);
    return finalize(NextResponse.json(await handler(database)));
  } catch (error) {
    const failure = error instanceof EventFailure ? { code: error.code, message: error.message, status: error.status } : publicError(error);
    const response = NextResponse.json({ error: { code: failure.code, message: failure.message } }, {
      status: failure.status, headers: { "Cache-Control": "private, no-store" },
    });
    return finalize ? finalize(response) : response;
  }
}
