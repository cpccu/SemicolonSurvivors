import type { NextRequest } from "next/server";
import { body, respond } from "@/modules/community/server/http";
import { adminInput } from "@/modules/community/validation";
import { adminChange } from "@/modules/administration/server/service";
export async function POST(request: NextRequest) { return respond(request, async (database) => adminChange(database, await body(request, adminInput)), { write: true }); }
