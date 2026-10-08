import type { NextRequest } from "next/server";
import { ApplicationError } from "@/lib/observability/errors";
import { eventResponse, parseInput, readEventBody } from "@/modules/events/server/http";
import { checkIn, promoteWaitlist, publishOrCancelEvent, registerOrCancel } from "@/modules/events/server/service";
import { checkInSchema, eventActionSchema, eventIdSchema } from "@/modules/events/validation";

export function POST(request: NextRequest, context: { params: Promise<{ eventId: string; action: string }> }) {
  return eventResponse(request, async (database) => {
    const parameters = await context.params;
    const eventId = parseInput(eventIdSchema, parameters.eventId);
    const body = await readEventBody(request);
    if (parameters.action === "checkin") return checkIn(database, eventId, parseInput(checkInSchema, body).token);
    parseInput(eventActionSchema, body);
    if (parameters.action === "register" || parameters.action === "cancel") return registerOrCancel(database, eventId, parameters.action);
    if (parameters.action === "publish" || parameters.action === "cancel-event") return publishOrCancelEvent(database, eventId, parameters.action);
    if (parameters.action === "promote") return promoteWaitlist(database, eventId);
    throw new ApplicationError("validation");
  }, { write: true });
}
