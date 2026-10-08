import type { NextRequest } from "next/server";
import { identityRoute } from "@/modules/identity/http";
import { importConfirmSchema } from "@/modules/identity/schemas";
import { readBoundedJson } from "@/lib/security/request";
import { confirmEnrollment } from "@/modules/identity/enrollment-service";

export async function POST(request: NextRequest) {
  return identityRoute(request, async ({ client }) => {
    const input = await readBoundedJson(request, importConfirmSchema);
    return confirmEnrollment(client, input.batchId, input.sendInvitations);
  });
}
