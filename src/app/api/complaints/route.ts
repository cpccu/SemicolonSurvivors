import type { NextRequest } from "next/server";
import { body, params, parse, respond } from "@/modules/community/server/http";
import { complaintInput, searchSchema } from "@/modules/community/validation";
import { createComplaint, listComplaints } from "@/modules/complaints/server/service";
export async function GET(request: NextRequest) { return respond(request, (database) => listComplaints(database, parse(searchSchema, params(request))), { member: true }); }
export async function POST(request: NextRequest) { return respond(request, async (database) => createComplaint(database, await body(request, complaintInput)), { write: true }); }
