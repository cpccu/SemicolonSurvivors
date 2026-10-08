"use client";

import { useId, useState, type FormEvent } from "react";
import { z } from "zod";
import { eventFailureMessage, eventRequest } from "../client";
import { liveEventSchema, type LiveEvent, type OrganizerCapabilities } from "../models";
import { createEventSchema } from "../validation";

export function CreateEventForm({ clubs, onCreated }: { clubs: OrganizerCapabilities["clubs"]; onCreated: (event: LiveEvent) => void }) {
  const prefix = useId();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    setPending(true); setError("");
    try {
      const input = createEventSchema.parse({
        clubId: values.get("clubId"), title: values.get("title"), description: values.get("description"),
        category: values.get("category"), venue: values.get("venue"), capacity: Number(values.get("capacity")),
        visibility: values.get("visibility"),
        startsAt: new Date(String(values.get("startsAt"))).toISOString(),
        endsAt: new Date(String(values.get("endsAt"))).toISOString(),
        registrationDeadline: new Date(String(values.get("registrationDeadline"))).toISOString(),
      });
      const result = await eventRequest("", z.object({ event: liveEventSchema }), input);
      onCreated(result.event); form.reset();
    } catch (failure) {
      setError(failure instanceof z.ZodError || failure instanceof RangeError ? "Check the event fields, date order, and capacity (1–10,000)." : eventFailureMessage(failure));
    } finally { setPending(false); }
  }
  return <form className="auth-form" onSubmit={(event) => void submit(event)}>
    <h3>Create a draft event</h3><p>Only your assigned clubs are offered. Publication requires a separate action. Enter times in your device&apos;s local timezone; students see Asia/Dhaka.</p>
    <label htmlFor={`${prefix}-club`}>Assigned club</label><select className="form-input" id={`${prefix}-club`} name="clubId" required>{clubs.map((club) => <option value={club.id} key={club.id}>{club.name}</option>)}</select>
    <label htmlFor={`${prefix}-title`}>Title</label><input className="form-input" id={`${prefix}-title`} name="title" minLength={3} maxLength={160} required />
    <label htmlFor={`${prefix}-description`}>Description</label><textarea className="form-input" id={`${prefix}-description`} name="description" minLength={10} maxLength={5000} rows={4} required />
    <label htmlFor={`${prefix}-category`}>Category</label><select className="form-input" id={`${prefix}-category`} name="category">{["Technology", "Community", "Creative", "Academic", "Other"].map((category) => <option key={category}>{category}</option>)}</select>
    <label htmlFor={`${prefix}-venue`}>Venue</label><input className="form-input" id={`${prefix}-venue`} name="venue" minLength={2} maxLength={200} required />
    <label htmlFor={`${prefix}-start`}>Starts at (device timezone)</label><input className="form-input" id={`${prefix}-start`} type="datetime-local" name="startsAt" required />
    <label htmlFor={`${prefix}-end`}>Ends at (device timezone)</label><input className="form-input" id={`${prefix}-end`} type="datetime-local" name="endsAt" required />
    <label htmlFor={`${prefix}-deadline`}>Registration deadline (device timezone)</label><input className="form-input" id={`${prefix}-deadline`} type="datetime-local" name="registrationDeadline" required />
    <label htmlFor={`${prefix}-capacity`}>Capacity</label><input className="form-input" id={`${prefix}-capacity`} type="number" name="capacity" min={1} max={10000} required />
    <label htmlFor={`${prefix}-visibility`}>Detail visibility</label><select className="form-input" id={`${prefix}-visibility`} name="visibility"><option value="campus">Active campus members</option><option value="public">Public published details</option></select>
    {error && <p role="alert">{error}</p>}<button className="button button--primary" disabled={pending}>{pending ? "Saving draft…" : "Save draft"}</button>
  </form>;
}
