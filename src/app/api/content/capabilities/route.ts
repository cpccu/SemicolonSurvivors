import type { NextRequest } from "next/server";
import { contentResponse } from "@/modules/content/server/http";
import { capabilities } from "@/modules/content/server/service";
export function GET(request: NextRequest) { return contentResponse(request, capabilities); }
