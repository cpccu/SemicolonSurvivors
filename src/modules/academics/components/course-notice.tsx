"use client";

import { ArrowRight, ArrowUpRight, Clock3, MapPin, Megaphone } from "lucide-react";
import { useCampus } from "@/components/layout/campus-context";
import { Badge } from "@/components/ui/primitives";

export function CourseChange({ expanded = false }: { expanded?: boolean }) {
  const { openDetail } = useCampus();
  return (
    <article className={`course-notice ${expanded ? "course-notice--expanded" : ""}`}>
      <div className="notice-topline">
        <span className="notice-priority"><Megaphone size={15} />Important course change</span>
        <Badge tone="warm">Demo notice</Badge>
      </div>
      <h2>New time.<br />New room. Same class.</h2>
      <p className="notice-course">Database Systems <span>· CSE 221 · Section A</span></p>
      <div className="change-comparison">
        <div className="change-before">
          <small>PREVIOUSLY</small>
          <p><Clock3 size={15} /><s>11:30–12:30</s></p>
          <p><MapPin size={15} /><s>Room 302</s></p>
        </div>
        <span className="change-arrow"><ArrowRight size={20} /></span>
        <div className="change-after">
          <small>UPDATED TO</small>
          <p><Clock3 size={15} /><strong>12:00–13:00</strong></p>
          <p><MapPin size={15} /><strong>Room 504</strong></p>
        </div>
      </div>
      <div className="notice-foot">
        <div><strong>Demo academic publisher</strong><small>Sample revision · 7 Oct 2026 · Asia/Dhaka</small></div>
        {!expanded && (
          <button aria-label="Read full Database Systems course change" onClick={() => openDetail({ kind: "notice", id: "course-change" })}>
            <ArrowUpRight size={21} />
          </button>
        )}
      </div>
      {expanded && (
        <div className="notice-expanded-copy">
          <h3>The change, explained</h3>
          <p>This synthetic example demonstrates how a published class correction would appear. The sample class has moved by 30 minutes and changed rooms; the course and section stay the same.</p>
          <h3>Sample revision history</h3>
          <ol>
            <li><strong>Revision 1</strong> · Original schedule: 11:30, Room 302.</li>
            <li><strong>Revision 2</strong> · Corrected schedule: 12:00, Room 504.</li>
          </ol>
          <p className="small-note">Preview fixture dated 7 October 2026. No live university class has been changed, and this notice does not establish your enrollment.</p>
        </div>
      )}
    </article>
  );
}
