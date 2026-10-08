"use client";

import { useEffect, useState } from "react";
import { z } from "zod";
import { eventFailureMessage, eventRequest, eventTime } from "../client";
import { liveEventSchema, type LiveEvent } from "../models";
import { LiveEventDetail } from "./live-event-detail";
import { useEventSessionRevision } from "../use-event-session";

const listSchema = z.object({ events: z.array(liveEventSchema), page: z.number(), hasMore: z.boolean() });
export function LiveEventsCollection({ query, category }: { query: string; category: string }) {
  const sessionRevision = useEventSessionRevision();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  return <><LiveEventsCollectionView key={sessionRevision} query={query} category={category} onSelect={setSelectedId} />{selectedId && <LiveEventDetail key={selectedId} eventId={selectedId} onClose={() => setSelectedId(null)} />}</>;
}

function LiveEventsCollectionView({ query, category, onSelect }: { query: string; category: string; onSelect: (eventId: string) => void }) {
  const [events, setEvents] = useState<LiveEvent[] | null>(null);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [revision, setRevision] = useState(0);
  const [loadedKey, setLoadedKey] = useState("");
  const requestKey = `${page}:${revision}`;
  useEffect(() => {
    const controller = new AbortController();
    const parameters = new URLSearchParams({ query, page: String(page), limit: "20" });
    if (category !== "All events") parameters.set("category", category);
    void eventRequest(`?${parameters}`, listSchema, undefined, controller.signal)
      .then((result) => { if (!controller.signal.aborted) { setEvents(result.events); setHasMore(result.hasMore); setError(""); setLoadedKey(`${page}:${revision}`); } })
      .catch((failure: unknown) => { if (!controller.signal.aborted) { setError(eventFailureMessage(failure)); setEvents(null); setLoadedKey(`${page}:${revision}`); } });
    return () => controller.abort();
  }, [query, category, page, revision]);
  return <section className="detail-section" aria-labelledby="live-events-heading">
    <div className="section-heading"><div><p className="eyebrow">Persistent campus collection</p><h2 id="live-events-heading">Live events</h2></div><button className="text-button" onClick={() => setRevision((value) => value + 1)}>Refresh</button></div>
     <p>Search and category filters apply to published campus events.</p>
    {loadedKey !== requestKey ? <p role="status">Loading the live event collection…</p> : error ? <p role="status">Live events are unavailable. {error}</p> : events === null ? <p role="status">Loading the live event collection…</p> : !events.length ? <p>No published events match this view. Campus-only details require an active account.</p> : <div className="resource-list">{events.map((event) => <article key={event.id} className="detail-source">
      <p>{event.category} · {event.status} · {event.visibility === "public" ? "Public details" : "Campus-only"}</p>
      <h3><button className="text-button" onClick={() => onSelect(event.id)}>{event.title}</button></h3>
      <p>{eventTime(event.starts_at)} · Asia/Dhaka · {event.venue}</p>
      <button className="button button--secondary" onClick={() => onSelect(event.id)}>Details and your ticket</button>
    </article>)}</div>}
    {!error && loadedKey === requestKey && <div className="detail-actions"><button className="button button--secondary" disabled={page === 1} onClick={() => setPage((value) => value - 1)}>Previous live events</button><span>Page {page}</span><button className="button button--secondary" disabled={!hasMore} onClick={() => setPage((value) => value + 1)}>Next live events</button></div>}
  </section>;
}
