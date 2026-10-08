import type { NextRequest } from "next/server";
import { body, respond } from "@/modules/community/server/http";
import { preferenceInput } from "@/modules/community/validation";
import { preferences, savePreferences } from "@/modules/directory/server/service";
export async function GET(request: NextRequest) { return respond(request, preferences, { member: true }); }
export async function PUT(request: NextRequest) { return respond(request, async (database) => savePreferences(database, await body(request, preferenceInput)), { write: true }); }
