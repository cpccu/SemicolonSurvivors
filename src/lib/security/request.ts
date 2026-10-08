import "server-only";
import type { NextRequest } from "next/server";
import type { z } from "zod";
import { ApplicationError } from "@/lib/observability/errors";
import { configuredSiteOrigin } from "./configuration";

export function assertSameOriginJson(request: NextRequest) {
  const origin = configuredSiteOrigin();
  const expected = new URL(origin);
  const actual = new URL(request.nextUrl.origin);
  const localProxyAlias = process.env.NODE_ENV !== "production"
    && expected.protocol === "http:"
    && ["localhost", "127.0.0.1"].includes(expected.hostname)
    && actual.protocol === "http:"
    && actual.hostname === "0.0.0.0"
    && actual.port === expected.port;
  if (request.headers.get("origin") !== origin || (!localProxyAlias && request.nextUrl.origin !== origin)) {
    throw new ApplicationError("authorization");
  }
  if (request.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase() !== "application/json") {
    throw new ApplicationError("validation");
  }
}

export async function readBoundedJson<T>(request: NextRequest, schema: z.ZodType<T>, maximumBytes = 4096): Promise<T> {
  assertSameOriginJson(request);
  const declaredLength = Number(request.headers.get("content-length"));
  if (declaredLength > maximumBytes || !request.body) throw new ApplicationError("validation");
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maximumBytes) {
        await reader.cancel();
        throw new ApplicationError("validation");
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    const result = schema.safeParse(JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)));
    if (!result.success) throw new ApplicationError("validation");
    return result.data;
  } catch (error) {
    if (error instanceof ApplicationError) throw error;
    throw new ApplicationError("validation");
  } finally {
    reader.releaseLock();
  }
}
