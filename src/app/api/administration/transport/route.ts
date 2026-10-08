import type { NextRequest } from "next/server";
import { body, respond } from "@/modules/community/server/http";
import { publishInput, routeInput } from "@/modules/community/validation";
import { publishRoute } from "@/modules/administration/server/service";
export async function POST(request: NextRequest) { return respond(request, async (database) => publishRoute(database, await body(request, publishInput(routeInput))), { write: true }); }
