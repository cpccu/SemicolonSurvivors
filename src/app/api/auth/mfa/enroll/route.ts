import type { NextRequest } from "next/server";
import { readBoundedJson } from "@/lib/security/request";
import { identityRoute } from "@/modules/identity/http";
import { mfaEnrollSchema } from "@/modules/identity/mfa-schemas";
import { enrollTotp } from "@/modules/identity/mfa-service";

export async function POST(request: NextRequest) {
  return identityRoute(request, async ({ client }) => {
    await readBoundedJson(request, mfaEnrollSchema, 256);
    return enrollTotp(client);
  });
}
