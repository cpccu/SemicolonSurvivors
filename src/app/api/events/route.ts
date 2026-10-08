import type { NextRequest } from "next/server";
import { eventResponse, parseInput, readEventBody } from "@/modules/events/server/http";
import { createEvent, listEvents } from "@/modules/events/server/service";
import { createEventSchema, eventListSchema } from "@/modules/events/validation";

export function GET(request: NextRequest) {
  return eventResponse(request, (database) => listEvents(database, parseInput(eventListSchema, Object.fromEntries(request.nextUrl.searchParams))));
}
export function POST(request: NextRequest) {
  return eventResponse(request, async (database) => createEvent(database, parseInput(createEventSchema, await readEventBody(request))), { write: true });
}
