import type { NextRequest } from "next/server";
import { params, parse, respond } from "@/modules/community/server/http";
import { searchSchema } from "@/modules/community/validation";
import { listRoutes } from "@/modules/transport/server/service";
export async function GET(request: NextRequest) { return respond(request, (database) => listRoutes(database, parse(searchSchema, params(request)))); }
