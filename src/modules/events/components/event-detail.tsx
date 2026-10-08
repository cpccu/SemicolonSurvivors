"use client";

import { ArrowRight, Bookmark, CalendarDays, Clock3, MapPin, Users } from "lucide-react";
import { useCampus } from "@/components/layout/campus-context";
import { Badge, IntegrationNote } from "@/components/ui/primitives";
import type { CampusEvent } from "@/modules/campus/data/fixtures";
import { EventArtwork } from "./event-artwork";

export function EventDetail({ event }: { event: CampusEvent }) {
  const { requireIntegration, saved, toggleSaved } = useCampus();
  const isSaved = saved.includes(event.id);
  return (
    <div className="event-detail">
      <EventArtwork variant={event.artwork} />
      <div className="detail-badges"><Badge tone="warm">Synthetic demo event</Badge><Badge>{event.category}</Badge></div>
      <div className="event-facts">
        <span><CalendarDays size={18} />{event.day} October 2026</span>
        <span><Clock3 size={18} />{event.time}</span>
        <span><MapPin size={18} />{event.venue}</span>
        <span><Users size={18} />{event.host}</span>
      </div>
      <div className="detail-actions">
        <button className="button button--primary" onClick={() => requireIntegration("Event registration")}>Registration options<ArrowRight size={17} /></button>
        <button className={`button button--secondary ${isSaved ? "is-saved" : ""}`} onClick={() => toggleSaved(event.id)} aria-pressed={isSaved}>
          <Bookmark size={17} fill={isSaved ? "currentColor" : "none"} />{isSaved ? "Saved in preview" : "Save for preview"}
        </button>
      </div>
      <IntegrationNote title="Browse now. Register when connected.">
        Registration is unavailable. Capacity and deadlines are not verified in this sample. No seat, waitlist position, or ticket can be issued. Saved items last only for this page session. Use the separate Live events collection for database-backed registrations.
      </IntegrationNote>
      <section className="detail-section">
        <h3>What to expect</h3>
        <p>{event.description}</p>
      </section>
      <section className="detail-section">
        <h3>The programme, at a glance</h3>
        <ul className="agenda-list">{event.agenda.map((item) => <li key={item}>{item}</li>)}</ul>
      </section>
      <div className="detail-source">
        <strong>About this source</strong>
        <p>Original CampusOS fixture · sample organizer identity · no institutional affiliation verified. Event dates, venues, and club names are synthetic.</p>
      </div>
    </div>
  );
}
