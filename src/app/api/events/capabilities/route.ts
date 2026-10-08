import type { NextRequest } from "next/server";
import { eventResponse } from "@/modules/events/server/http";
import { organizerCapabilities } from "@/modules/events/server/service";

export function GET(request: NextRequest) {
  return eventResponse(request, organizerCapabilities, { member: true });
}
