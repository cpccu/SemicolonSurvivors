import type { NextRequest } from "next/server";
import { administrationCreateClub } from "@/modules/administration/server/service";
import { administrationClubInput } from "@/modules/administration/validation";
import { body, respond } from "@/modules/community/server/http";

export async function POST(request: NextRequest) {
  return respond(request, async (database) => administrationCreateClub(database, await body(request, administrationClubInput)), { write: true });
}
