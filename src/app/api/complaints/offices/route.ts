import type { NextRequest } from "next/server";
import { respond } from "@/modules/community/server/http";
import { listOffices } from "@/modules/complaints/server/service";
export async function GET(request: NextRequest) { return respond(request, listOffices, { member: true }); }
