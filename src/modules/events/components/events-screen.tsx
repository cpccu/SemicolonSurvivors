"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import { useCampus } from "@/components/layout/campus-context";
import { ModulePageHeader } from "@/modules/campus/components/module-page-header";
import { LiveEventsCollection } from "./live-events-collection";
import { OrganizerPanel } from "./organizer-panel";

export function EventsScreen() {
  const { filters, setFilter } = useCampus();
  const query = filters.events ?? "";
  const [category, setCategory] = useState("All events");
  const [organizerOpen, setOrganizerOpen] = useState(false);

  return <div className="module-page">
    <ModulePageHeader module="events" preview={false} action={<button className="button button--secondary" onClick={() => setOrganizerOpen(true)}>Organizer workspace</button>}>
      Published event details and registration workflows are filtered by account and organizer permissions.
    </ModulePageHeader>
    <div className="collection-toolbar">
      <div className="filter-tabs">{["All events", "Technology", "Community", "Creative"].map((value) => <button key={value} className={category === value ? "is-active" : ""} aria-pressed={category === value} onClick={() => setCategory(value)}>{value}</button>)}</div>
      <div className="collection-search"><Search size={17} /><label className="sr-only" htmlFor="event-filter">Search published events</label><input id="event-filter" placeholder="Search published events" maxLength={120} value={query} onChange={(event) => setFilter("events", event.target.value)} /></div>
    </div>
    <LiveEventsCollection key={`${query}:${category}`} query={query} category={category} />
    {organizerOpen && <OrganizerPanel onClose={() => setOrganizerOpen(false)} />}
  </div>;
}
