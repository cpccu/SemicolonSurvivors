"use client";

import { ArrowRight, ArrowUpRight, BookOpen, CalendarDays, CircleHelp, Megaphone } from "lucide-react";
import { useCampus } from "@/components/layout/campus-context";

export function CampusTimeline() {
  const { navigate } = useCampus();
  return <section className="campus-timeline" aria-labelledby="campus-timeline-heading">
    <div className="timeline-heading"><div><p className="eyebrow">YOUR CAMPUS SHORTCUTS</p><h2 id="campus-timeline-heading">Keep moving forward.</h2></div><span className="badge badge--green">Connected</span></div>
    <p className="timeline-disclosure">Published notices, events, resources, and answers remain in their account-aware modules.</p>
    <ol className="timeline-list">
      <li><button onClick={() => navigate("academics")}><span className="timeline-marker timeline-marker--notice"><Megaphone size={19} /><small>READ</small></span><span className="timeline-copy"><small>Academic updates</small><strong>Check published notices</strong><span>Room changes, deadlines, and course updates</span></span><ArrowUpRight size={17} /></button></li>
      <li><button onClick={() => navigate("events")}><span className="timeline-marker"><CalendarDays size={19} /><small>JOIN</small></span><span className="timeline-copy"><small>Clubs & events</small><strong>Find something happening</strong><span>Register, cancel, or show your ticket</span></span><ArrowUpRight size={17} /></button></li>
      <li><button onClick={() => navigate("resources")}><span className="timeline-marker"><BookOpen size={19} /><small>LEARN</small></span><span className="timeline-copy"><small>Resource Hub</small><strong>Open approved materials</strong><span>Preview, download, or summarize reviewed text</span></span><ArrowUpRight size={17} /></button></li>
      <li><button onClick={() => navigate("helpdesk")}><span className="timeline-marker"><CircleHelp size={19} /><small>ASK</small></span><span className="timeline-copy"><small>AI Helpdesk</small><strong>Ask with approved sources</strong><span>Get a grounded answer with quotations</span></span><ArrowUpRight size={17} /></button></li>
    </ol>
    <button className="timeline-footer" onClick={() => navigate("events")}><ArrowRight size={17} />Open the campus event workflow<ArrowUpRight size={16} /></button>
  </section>;
}
