import type { NextRequest } from "next/server";
import { respond } from "@/modules/community/server/http";
import { capabilities } from "@/modules/administration/server/service";
export async function GET(request: NextRequest) { return respond(request, capabilities, { member: true }); }
