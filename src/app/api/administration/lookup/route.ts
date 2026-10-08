import type { NextRequest } from "next/server";
import { administrationLookup } from "@/modules/administration/server/service";
import { administrationLookupInput } from "@/modules/administration/validation";
import { params, parse, respond } from "@/modules/community/server/http";

export async function GET(request: NextRequest) {
  const input = parse(administrationLookupInput, params(request));
  return respond(request, (database) => administrationLookup(database, input));
}
