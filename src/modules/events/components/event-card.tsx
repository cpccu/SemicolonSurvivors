"use client";

import { ArrowRight, Clock3, MapPin } from "lucide-react";
import type { CampusEvent } from "@/modules/campus/data/fixtures";
import { useCampus } from "@/components/layout/campus-context";

export function EventCard({ event }: { event: CampusEvent }) {
  const { openDetail } = useCampus();
  const viewEvent = () => openDetail({ kind: "event", id: event.id });

  const categoryMap: Record<string, string> = {
    "Technology": "workshop",
    "Community": "seminar",
    "Creative": "cultural"
  };
  const categoryClass = categoryMap[event.category] || "academic";

  return (
    <article className="event-card-gradient">
      <div className={`event-gradient-bg ${categoryClass}`}>
        <div className="event-badge-date">
          <span className="date-day">{event.day}</span>
          <span className="date-month">{event.month}</span>
        </div>

        <div className="event-content">
          <span className="event-category">{event.category}</span>

          <h3 className="event-title">{event.title}</h3>

          <p className="event-meta">
            <Clock3 size={16} />
            <span>{event.time.split(" · ")[0]}</span>
            <MapPin size={16} />
            <span>{event.venue}</span>
          </p>

          <button className="event-cta glass" onClick={viewEvent}>
            View Details
            <ArrowRight size={16} />
          </button>
        </div>
      </div>
    </article>
  );
}
