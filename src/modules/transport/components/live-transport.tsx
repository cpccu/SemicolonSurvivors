"use client";
import { useState } from "react";
import { z } from "zod";
import { useCampusSession } from "@/lib/auth/use-campus-session";
import { preferencesSchema, routeSchema, type LiveRoute } from "@/modules/community/models";
import { campusTime, communityRequest, failureMessage } from "@/modules/community/client";
import { LoadState, Pager, Provenance, useCommunityLoad } from "@/modules/community/components/live-shared";
import { nextDeparture, operatingDays } from "../lib/live-schedule";
import { useCampusClock } from "../lib/use-campus-clock";

const listSchema = z.object({ routes: z.array(routeSchema), page: z.number(), hasMore: z.boolean() });
const savedSchema = z.object({ preferences: preferencesSchema.nullable() });
export function LiveTransport() {
  const [page, setPage] = useState(1); const [selected, setSelected] = useState<string | null>(null);
  const result = useCommunityLoad(`/api/transport?page=${page}`, listSchema);
  return <section className="detail-section"><div className="section-heading"><div><p className="eyebrow">Persisted timetable</p><h2>Reviewed campus routes</h2></div><button className="text-button" onClick={result.reload}>Refresh routes</button></div><p>Scheduled departures only. Vehicle tracking and travel-time estimates are not provided.</p><LoadState loading={result.loading} error={result.error} />{result.data && <>{!result.data.routes.length && <p>No reviewed routes are published yet.</p>}{result.data.routes.map((route) => <article className="detail-source" key={route.id}><h3><button className="text-button" aria-expanded={selected === route.id} onClick={() => setSelected(selected === route.id ? null : route.id)}>{route.title}</button></h3>{selected === route.id && <RouteDetails route={route} />}</article>)}<Pager page={page} hasMore={result.data.hasMore} onPage={setPage} /></>}</section>;
}
function RouteDetails({ route }: { route: LiveRoute }) {
  const now = useCampusClock(); const next = now ? nextDeparture(route, now) : null;
  const { session } = useCampusSession(); const [message, setMessage] = useState(""); const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true); setMessage("");
    try {
      const current = await communityRequest("/api/directory/preferences", savedSchema);
      const preferences = current.preferences;
      await communityRequest("/api/directory/preferences", savedSchema, { method: "PUT", data: { interests: preferences?.interests ?? [], courses: preferences?.courses ?? [], clubs: preferences?.clubs ?? [], section: preferences?.section ?? "", savedRouteId: route.id } });
      setMessage("Route saved to your account preferences.");
    } catch (error) { setMessage(failureMessage(error)); } finally { setBusy(false); }
  };
  return <><p><strong>Next scheduled departure: </strong>{next ? campusTime(next.scheduledAt) : now ? "No departure within the next 120 days." : "Calculating…"} · Asia/Dhaka</p><ol>{route.stops.map((stop, index) => <li key={`${index}:${stop}`}>{stop}</li>)}</ol><h4>Operating days and departure times</h4>{route.schedules.map((schedule, index) => <p key={index}>{schedule.time} · {schedule.days.map((day) => operatingDays[day]).join(", ")}</p>)}{route.notice && <p><strong>Service notice:</strong> {route.notice}</p>}{route.exceptions.map((exception, index) => <p key={index}>{exception.date} · {exception.cancelled ? "No service" : "Information only"} · {exception.note}</p>)}<Provenance record={route} /><button className="button button--secondary" disabled={busy || session?.account?.status !== "active"} onClick={() => void save()}>{busy ? "Saving…" : "Save this route"}</button>{session?.account?.status !== "active" && <p>Sign in to save a route.</p>}{message && <p role="status">{message}</p>}</>;
}
