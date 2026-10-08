"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { z } from "zod";
import { eventFailureMessage, eventRequest, eventTime } from "../client";
import type { LiveEvent } from "../models";
import { maximumTicketInputLength, parseTicketCode, type ParsedTicketCode } from "../ticket-code";
import { TicketCameraReader } from "./ticket-camera-reader";

export function OrganizerCheckIn({ events }: { events: LiveEvent[] }) {
  const prefix = useId();
  const [eventId, setEventId] = useState(events[0]?.id ?? "");
  const [input, setInput] = useState("");
  const [candidate, setCandidate] = useState<ParsedTicketCode | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const inFlight = useRef(false);
  const controller = useRef<AbortController | null>(null);
  const requestTimeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const mounted = useRef(true);
  const recordButton = useRef<HTMLButtonElement>(null);
  useEffect(() => { if (candidate) recordButton.current?.focus(); }, [candidate]);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; clearTimeout(requestTimeout.current); controller.current?.abort(); };
  }, []);
  const selectedEvent = events.find((event) => event.id === eventId);

  function review(value: string) {
    setError(""); setMessage(""); setCandidate(null);
    const result = parseTicketCode(value, eventId);
    if (!result.success) { setError(result.message); return; }
    setCandidate(result.ticket); setInput("");
  }
  function submitReview(event: FormEvent<HTMLFormElement>) { event.preventDefault(); if (!inFlight.current) review(input); }
  async function recordCheckIn() {
    if (inFlight.current || !candidate || !selectedEvent || candidate.eventId !== selectedEvent.id) return;
    inFlight.current = true; setPending(true); setError(""); setMessage("");
    const abort = new AbortController();
    controller.current = abort;
    let timedOut = false;
    const timeout = setTimeout(() => { timedOut = true; abort.abort(); }, 20_000);
    requestTimeout.current = timeout;
    try {
      const result = await eventRequest(`/${selectedEvent.id}/checkin`, z.object({ already_checked_in: z.boolean(), checked_in_at: z.string() }), { token: candidate.token }, abort.signal);
      if (abort.signal.aborted) return;
      setCandidate(null);
      setMessage(`${result.already_checked_in ? "Ticket was already checked in" : "Check-in recorded"} · ${eventTime(result.checked_in_at)}.`);
    } catch (failure) {
      if (mounted.current) setError(timedOut ? "The check-in response timed out and may have been recorded. No automatic retry was sent. A repeat scan will report the original check-in." : eventFailureMessage(failure));
    } finally {
      clearTimeout(timeout);
      if (mounted.current) { inFlight.current = false; setPending(false); }
    }
  }

  return <section className="detail-section event-check-in"><h3>Ticket QR / manual check-in</h3>
    <p>Select the exact event. Review a decoded QR payload or manual code, then choose Record check-in. Check-in opens two hours before the start and closes at the end. Repeat scans report the original check-in.</p>
    <label htmlFor={`${prefix}-event`}>Event to check in</label><select id={`${prefix}-event`} className="form-input" disabled={pending} value={eventId} onChange={(event) => { setEventId(event.target.value); setCandidate(null); setInput(""); setError(""); setMessage(""); }}>
      {events.map((event) => <option key={event.id} value={event.id}>{event.title}</option>)}
    </select>
    {!pending && !candidate && <TicketCameraReader key={eventId} disabled={!selectedEvent} onDecoded={review} />}
    <form className="auth-form" onSubmit={submitReview}>
      <label htmlFor={`${prefix}-ticket`}>Decoded QR payload or manual ticket code</label><textarea id={`${prefix}-ticket`} className="form-input" maxLength={maximumTicketInputLength} autoComplete="off" spellCheck={false} rows={3} value={input} disabled={pending} onChange={(event) => { setInput(event.target.value); setCandidate(null); }} required />
      <button className="button button--secondary" disabled={pending || !selectedEvent}>Review ticket</button>
    </form>
    {candidate && <div className="event-check-in-review" role="region" aria-label="Review check-in"><h4>Ready to record check-in</h4><p><strong>{selectedEvent?.title}</strong> · {selectedEvent && eventTime(selectedEvent.starts_at)}</p><p>{candidate.source === "qr" ? "The QR event matches the selected event." : "Manual codes do not encode an event. The server will verify this code against the selected event."} Ticket validity and staff permissions are verified by the server when you record check-in.</p><div className="detail-actions">
      <button ref={recordButton} type="button" className="button button--primary" disabled={pending} onClick={() => void recordCheckIn()}>{pending ? "Recording…" : "Record check-in"}</button>
      <button type="button" className="button button--secondary" disabled={pending} onClick={() => setCandidate(null)}>Discard scanned ticket</button>
    </div></div>}
    {error && <p role="alert">{error}</p>}{message && <p role="status">{message}</p>}
  </section>;
}
