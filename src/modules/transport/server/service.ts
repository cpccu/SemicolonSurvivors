import "server-only";
import { z } from "zod";
import { checkResult, CommunityFailure, type CommunityClient } from "@/modules/community/server/database";
import { routeSchema } from "@/modules/community/models";
import { literalSearch, type searchSchema } from "@/modules/community/validation";
import { nextDeparture } from "../lib/live-schedule";

export async function listRoutes(database: CommunityClient, input: z.infer<typeof searchSchema>) {
  const start = (input.page - 1) * input.limit;
  let query = database.from("community_routes").select("*").eq("state", "published").order("title").order("id").range(start, start + input.limit);
  if (input.query) query = query.ilike("title", literalSearch(input.query));
  const result = await query; checkResult(result.error);
  const routes = z.array(routeSchema).parse(result.data);
  return { routes: routes.slice(0, input.limit), page: input.page, hasMore: routes.length > input.limit };
}
export async function routeDetail(database: CommunityClient, id: string) {
  const result = await database.from("community_routes").select("*").eq("id", id).maybeSingle(); checkResult(result.error);
  if (!result.data) throw new CommunityFailure("not_found", 404, "This route is unavailable.");
  const route = routeSchema.parse(result.data);
  return { route, nextDeparture: nextDeparture(route, new Date()), calculationTimezone: "Asia/Dhaka", liveTracking: false };
}
