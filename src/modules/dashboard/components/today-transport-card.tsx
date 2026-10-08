"use client";

import { ArrowRight, BusFront, Clock3 } from "lucide-react";
import { z } from "zod";
import { useCampus } from "@/components/layout/campus-context";
import { routeSchema } from "@/modules/community/models";
import { LoadState, useCommunityLoad } from "@/modules/community/components/live-shared";
import { nextDeparture } from "@/modules/transport/lib/live-schedule";
import { useCampusClock } from "@/modules/transport/lib/use-campus-clock";

const listSchema = z.object({ routes: z.array(routeSchema), page: z.number(), hasMore: z.boolean() });

function time(value: string) {
  return new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Dhaka", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

export function TodayTransportCard() {
  const { navigate } = useCampus();
  const now = useCampusClock();
  const result = useCommunityLoad("/api/transport?page=1", listSchema);
  const route = result.data?.routes[0];
  const next = route && now ? nextDeparture(route, now) : null;
  const destination = route?.stops[route.stops.length - 1];

  return <section className="today-live-transport" aria-label="Campus transport summary">
    <div className="today-live-transport-top"><span><BusFront size={17} />CAMPUS TRANSPORT</span><span>Published routes</span></div>
    <h2>{route?.title ?? "Campus transport"}</h2>
    <LoadState loading={result.loading} error={result.error} />
    {route && <>
      <div className="today-live-transport-next"><strong>{next ? time(next.scheduledAt) : "— — : — —"}</strong><span><Clock3 size={14} />{next ? "Next scheduled departure" : "No upcoming departure"}</span></div>
      <p className="today-live-transport-route">{route.stops[0]} <span>→</span> {destination}</p>
      <p className="today-live-transport-note">Scheduled service · Asia/Dhaka · No live tracking</p>
    </>}
    {result.data && !route && <p className="today-live-transport-empty">No published campus routes are available yet.</p>}
    <button className="today-live-transport-action" onClick={() => navigate("transport")}>Open transport routes<ArrowRight size={16} /></button>
  </section>;
}
