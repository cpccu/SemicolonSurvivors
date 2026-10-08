import type { NextRequest } from "next/server";
import { uploadMedia } from "@/modules/community/server/media";
export async function POST(request: NextRequest) { return uploadMedia(request); }
