import type { NextRequest } from "next/server";
import { eventResponse, parseInput } from "@/modules/events/server/http";
import { ownTicket } from "@/modules/events/server/service";
import { eventIdSchema } from "@/modules/events/validation";

export function GET(request: NextRequest, context: { params: Promise<{ eventId: string }> }) {
  return eventResponse(request, async (database) => ownTicket(database, parseInput(eventIdSchema, (await context.params).eventId)), { member: true });
}
