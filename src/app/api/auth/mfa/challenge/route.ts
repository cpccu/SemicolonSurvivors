import type { NextRequest } from "next/server";
import { readBoundedJson } from "@/lib/security/request";
import { identityRoute } from "@/modules/identity/http";
import { mfaChallengeSchema } from "@/modules/identity/mfa-schemas";
import { challengeTotp } from "@/modules/identity/mfa-service";

export async function POST(request: NextRequest) {
  return identityRoute(request, async ({ client }) => {
    const input = await readBoundedJson(request, mfaChallengeSchema, 512);
    return challengeTotp(client, input.factorId);
  });
}
