import type { NextRequest } from "next/server";
import { readBoundedJson } from "@/lib/security/request";
import { identityRoute } from "@/modules/identity/http";
import { mfaRemoveSchema } from "@/modules/identity/mfa-schemas";
import { removeTotp } from "@/modules/identity/mfa-service";

export async function POST(request: NextRequest) {
  return identityRoute(request, async ({ client }) => {
    const input = await readBoundedJson(request, mfaRemoveSchema, 512);
    return removeTotp(client, input.factorId, input.confirmRemoval);
  });
}
