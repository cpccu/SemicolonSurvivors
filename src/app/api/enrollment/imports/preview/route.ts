import type { NextRequest } from "next/server";
import { identityRoute } from "@/modules/identity/http";
import { importPreviewSchema } from "@/modules/identity/schemas";
import { readBoundedJson } from "@/lib/security/request";
import { previewEnrollment } from "@/modules/identity/enrollment-service";

export async function POST(request: NextRequest) {
  return identityRoute(request, async ({ client }) => {
    const input = await readBoundedJson(request, importPreviewSchema, 32768);
    return previewEnrollment(client, input.rows);
  });
}
