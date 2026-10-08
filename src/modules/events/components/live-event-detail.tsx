"use client";

import { useEffect, useState } from "react";
import { z } from "zod";
import { Dialog } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/primitives";
import { eventFailureMessage, eventRequest, eventTime } from "../client";
import { liveEventSchema, ticketSchema, type EventTicket, type LiveEvent } from "../models";
import { useEventSessionRevision } from "../use-event-session";
import { PrivateTicketQr } from "./private-ticket-qr";

const detailSchema = z.object({ event: liveEventSchema, host: z.string() });
const ticketResponseSchema = z.object({ ticket: ticketSchema.nullable() });

export function LiveEventDetail({ eventId, onClose }: { eventId: string; onClose: () => void }) {
  const sessionRevision = useEventSessionRevision();
  return <LiveEventDetailView key={sessionRevision} eventId={eventId} onClose={onClose} />;
}

function LiveEventDetailView({ eventId, onClose }: { eventId: string; onClose: () => void }) {
  const [detail, setDetail] = useState<{ event: LiveEvent; host: string } | null>(null);
  const [ticket, setTicket] = useState<EventTicket | null>(null);
  const [error, setError] = useState("");
  const [ticketError, setTicketError] = useState("");
  const [pending, setPending] = useState(false);
  const [revision, setRevision] = useState(0);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [observedAt, setObservedAt] = useState(() => Date.now());
  const [ticketReadRevision, setTicketReadRevision] = useState(-1);

  useEffect(() => {
    const timer = setInterval(() => setObservedAt(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void eventRequest(`/${eventId}`, detailSchema, undefined, controller.signal)
      .then((result) => { if (!controller.signal.aborted) { setDetail(result); setError(""); } })
      .catch((failure: unknown) => { if (!controller.signal.aborted) { setDetail(null); setError(eventFailureMessage(failure)); } });
    void eventRequest(`/${eventId}/ticket`, ticketResponseSchema, undefined, controller.signal)
      .then((result) => { if (!controller.signal.aborted) { setTicket(result.ticket); setTicketError(""); setTicketReadRevision(revision); } })
      .catch((failure: unknown) => { if (!controller.signal.aborted) { setTicket(null); setTicketError(eventFailureMessage(failure)); setTicketReadRevision(revision); } });
    return () => controller.abort();
  }, [eventId, revision]);

  async function changeRegistration(action: "register" | "cancel") {
    setPending(true); setTicketError("");
    try {
      const result = await eventRequest(`/${eventId}/${action}`, ticketResponseSchema, {});
      setTicket(result.ticket); setConfirmCancel(false);
    } catch (failure) { setTicketError(eventFailureMessage(failure)); }
    finally { setPending(false); }
  }

  const event = detail?.event;
  const isRegistered = ticket?.status === "registered" || ticket?.status === "waitlisted";
  const registrationClosed = !!event && (event.status !== "published" || Date.parse(event.registration_deadline) <= observedAt);
  const ticketLoading = ticketReadRevision !== revision;
  return <Dialog open onClose={onClose} title={event?.title ?? "Live event"} className="detail-dialog">
    {error && <p role="alert">{error} <button className="text-button" onClick={() => setRevision((value) => value + 1)}>Retry</button></p>}
    {!event && !error && <p role="status">Loading event details…</p>}
    {event && <div className="event-detail">
      <div className="detail-badges"><Badge tone="green">Live database event</Badge><Badge>{event.status}</Badge><Badge>{event.visibility === "public" ? "Public details" : "Campus members"}</Badge></div>
      <section className="detail-section"><h3>When and where</h3>
        <p>{eventTime(event.starts_at)} – {eventTime(event.ends_at)} · Asia/Dhaka</p>
        <p>{event.venue} · {detail.host}</p>
        <p>Registration closes {eventTime(event.registration_deadline)} · Capacity {event.capacity}</p>
      </section>
      <section className="detail-section"><h3>Your registration</h3>
        {ticketLoading && <p role="status">Refreshing your saved registration…</p>}
        <p role="status">{ticket ? ticket.status === "waitlisted" ? `Waitlisted · position ${ticket.waitlist_position ?? "pending"}. A seat is promoted automatically in queue order before the event starts.` : ticket.status === "cancelled" ? "Your registration is cancelled." : ticket.checked_in_at ? `Checked in ${eventTime(ticket.checked_in_at)}.` : "Your seat is confirmed." : ticketLoading || ticketError ? "No ticket has been loaded for your account." : "You have not registered for this event."}</p>
        {ticketError && <p role="alert">{ticketError}</p>}
        {!ticketLoading && ticket?.status === "registered" && ticket.event_id === event.id && ticket.ticket_token && event.status === "published" && <div className="detail-source">
          <strong>Your private QR ticket</strong>
          <PrivateTicketQr key={ticket.ticket_token} eventId={event.id} token={ticket.ticket_token} />
          <p>Manual fallback: show this private code to an authorized organizer for this event.</p>
          <code className="event-ticket-code">{ticket.ticket_token}</code>
        </div>}
        <div className="detail-actions">
          {!isRegistered && <button className="button button--primary" disabled={pending || ticketLoading || registrationClosed} onClick={() => void changeRegistration("register")}>{pending ? "Saving…" : registrationClosed ? "Registration closed" : "Register / join waitlist"}</button>}
          {isRegistered && !ticket?.checked_in_at && <button className="button button--secondary" disabled={pending || ticketLoading} onClick={() => setConfirmCancel(true)}>Cancel registration</button>}
          <button className="button button--secondary" disabled={pending || ticketLoading} onClick={() => setRevision((value) => value + 1)}>Refresh ticket</button>
        </div>
        {confirmCancel && <div className="detail-source"><p>Release your seat or leave the waitlist? A released seat may immediately go to the next student.</p><div className="detail-actions"><button className="button button--secondary" disabled={pending} onClick={() => setConfirmCancel(false)}>Keep registration</button><button className="button button--primary" disabled={pending} onClick={() => void changeRegistration("cancel")}>{pending ? "Cancelling…" : "Confirm cancellation"}</button></div></div>}
      </section>
      <section className="detail-section"><h3>About this event</h3><p style={{ whiteSpace: "pre-wrap" }}>{event.description}</p></section>
    </div>}
  </Dialog>;
}
