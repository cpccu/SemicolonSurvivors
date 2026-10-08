import type { NextRequest } from "next/server";
import { readBoundedJson } from "@/lib/security/request";
import { identityRoute } from "@/modules/identity/http";
import { mfaVerifySchema } from "@/modules/identity/mfa-schemas";
import { verifyTotp } from "@/modules/identity/mfa-service";

export async function POST(request: NextRequest) {
  return identityRoute(request, async ({ client }) => {
    const input = await readBoundedJson(request, mfaVerifySchema, 512);
    return verifyTotp(client, input);
  });
}
