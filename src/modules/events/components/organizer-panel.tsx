"use client";

import { useEffect, useState } from "react";
import { z } from "zod";
import { Dialog } from "@/components/ui/dialog";
import { eventFailureMessage, eventRequest, eventTime } from "../client";
import { liveEventSchema, organizerCapabilitiesSchema, type LiveEvent, type OrganizerCapabilities } from "../models";
import { useEventSessionRevision } from "../use-event-session";
import { CreateEventForm } from "./create-event-form";
import { OrganizerCheckIn } from "./organizer-check-in";

export function OrganizerPanel({ onClose }: { onClose: () => void }) {
  const sessionRevision = useEventSessionRevision();
  return <OrganizerPanelView key={sessionRevision} onClose={onClose} />;
}

function OrganizerPanelView({ onClose }: { onClose: () => void }) {
  const [capabilities, setCapabilities] = useState<OrganizerCapabilities | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const [revision, setRevision] = useState(0);
  const [cancelId, setCancelId] = useState<string | null>(null);
  const [verifiedRevision, setVerifiedRevision] = useState(-1);
  useEffect(() => {
    const controller = new AbortController();
    void eventRequest("/capabilities", organizerCapabilitiesSchema, undefined, controller.signal)
      .then((result) => { if (!controller.signal.aborted) { setCapabilities(result); setError(""); setVerifiedRevision(revision); } })
      .catch((failure: unknown) => { if (!controller.signal.aborted) { setError(eventFailureMessage(failure)); setCapabilities(null); setVerifiedRevision(revision); } });
    return () => controller.abort();
  }, [revision]);

  function persistedEvent(event: LiveEvent) {
    setCapabilities((current) => current ? { ...current, events: [event, ...current.events.filter((entry) => entry.id !== event.id)].slice(0, 100) } : current);
  }
  async function changeEvent(eventId: string, action: "publish" | "cancel-event") {
    setPending(true); setError(""); setMessage("");
    try {
      const result = await eventRequest(`/${eventId}/${action}`, z.object({ event: liveEventSchema }), {});
      persistedEvent(result.event); setCancelId(null);
      setMessage(action === "publish" ? "Event published in the live collection." : "Event cancelled. Registration states have been updated and tickets invalidated.");
    } catch (failure) { setError(eventFailureMessage(failure)); }
    finally { setPending(false); }
  }
  const published = capabilities?.events.filter((event) => event.status === "published") ?? [];
  return <Dialog open onClose={onClose} title="Live organizer workspace" className="detail-dialog">
    <p>Club assignments, active status, and MFA are verified by the server for every privileged action.</p>
    {error && <p role="alert">{error}</p>}{message && <p role="status">{message}</p>}
    {verifiedRevision !== revision && <p role="status">Verifying organizer access…</p>}
    <button className="button button--secondary" disabled={pending} onClick={() => setRevision((value) => value + 1)}>Refresh access</button>
    {capabilities && !capabilities.clubs.length && <p>No MFA-verified club organizer assignments are available to this account. Sign in with your assigned account and verify MFA to manage events.</p>}
    {!!capabilities?.clubs.length && verifiedRevision === revision && <>
      <CreateEventForm clubs={capabilities.clubs} onCreated={(event) => { persistedEvent(event); setMessage("Draft saved in the database. Review it below before publishing."); }} />
      <section className="detail-section"><h3>Assigned events · latest 100</h3>
        {!capabilities.events.length && <p>No events have been created for your assigned clubs.</p>}
        {capabilities.events.map((event) => <article className="detail-source" key={event.id}><strong>{event.title}</strong><p>{event.status} · {eventTime(event.starts_at)} · {event.venue}</p><p>{event.description}</p><p>{event.capacity} seats · {event.visibility} details · registration deadline {eventTime(event.registration_deadline)}</p><div className="detail-actions">
          {event.status === "draft" && <button className="button button--primary" disabled={pending} onClick={() => void changeEvent(event.id, "publish")}>Publish event</button>}
          {event.status !== "cancelled" && <button className="button button--secondary" disabled={pending} onClick={() => setCancelId(event.id)}>Cancel event</button>}
          {cancelId === event.id && <><span>Cancel this event and invalidate all tickets?</span><button className="button button--primary" disabled={pending} onClick={() => void changeEvent(event.id, "cancel-event")}>Confirm event cancellation</button><button className="button button--secondary" disabled={pending} onClick={() => setCancelId(null)}>Keep event</button></>}
        </div></article>)}
      </section>
      {published.length ? <OrganizerCheckIn key={published.map((event) => event.id).join(":")} events={published} /> : <section className="detail-section"><h3>Ticket check-in</h3><p>No published event is available for check-in.</p></section>}
    </>}
  </Dialog>;
}
