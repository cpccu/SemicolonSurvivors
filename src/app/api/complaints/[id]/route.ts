import type { NextRequest } from "next/server";
import { body, parse, respond } from "@/modules/community/server/http";
import { complaintTransitionInput, uuid } from "@/modules/community/validation";
import { complaintDetail, transitionComplaint } from "@/modules/complaints/server/service";
export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) { return respond(request, async (database) => complaintDetail(database, parse(uuid, (await context.params).id)), { member: true }); }
export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) { return respond(request, async (database) => transitionComplaint(database, parse(uuid, (await context.params).id), await body(request, complaintTransitionInput)), { write: true }); }
