import type { NextRequest } from "next/server";
import { identityRoute } from "@/modules/identity/http";
import { claimSchema } from "@/modules/identity/schemas";
import { readBoundedJson } from "@/lib/security/request";
import { claimStudentAccount } from "@/modules/identity/invitation-service";

export async function POST(request: NextRequest) {
  return identityRoute(request, async () => {
    const input = await readBoundedJson(request, claimSchema);
    return claimStudentAccount(input.studentId);
  });
}
