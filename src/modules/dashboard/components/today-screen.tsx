"use client";

import { Activity, ArrowRight, CalendarDays, Search, ShieldCheck } from "lucide-react";
import { CAMPUS_CONCEPT_LABEL } from "@/lib/branding";
import { campusAccountPresentation } from "@/components/layout/account-presentation";
import { useCampus } from "@/components/layout/campus-context";
import { SectionHeading } from "@/components/ui/primitives";
import { LiveContent } from "@/modules/content/components/live-content";
import { LiveEventsCollection } from "@/modules/events/components/live-events-collection";
import { LiveResources } from "@/modules/resources/components/live-resources";
import { TodayTransportCard } from "./today-transport-card";
import { formatCampusDate } from "@/modules/transport/lib/schedule";
import { useCampusClock } from "@/modules/transport/lib/use-campus-clock";
import { AccountWorkspace, ActionsSummary, CampusQuickActions, GettingStartedCard } from "./dashboard-panels";
import { CampusTimeline } from "./campus-timeline";

export function TodayScreen() {
  const { session, navigate, openSearch } = useCampus();
  const account = campusAccountPresentation(session);
  const today = useCampusClock();

  return (
    <div className="today-screen">
      <div className="today-page-heading"><div><p className="eyebrow">YOUR DAILY CAMPUS SPACE</p><p>{account.active ? <>Welcome back, <strong>{account.name}</strong></> : "Your campus day starts here"}</p></div><div className="today-date"><CalendarDays size={18} /><span>{today ? formatCampusDate(today) : "Your campus day"}<small>Asia/Dhaka · Campus time</small></span></div></div>
      <div className="today-overview">
      <section className="today-intro today-hero" aria-labelledby="today-heading">
        <div className="today-hero-copy">
          <p className="eyebrow"><span className="eyebrow-dot" />TODAY · CAMPUS WORKSPACE</p>
          <div className="today-hero-title-row"><h1 id="today-heading">My Campus <span>Today.</span></h1><span className="hero-state"><span aria-hidden="true" /> Signed-in workspace</span></div>
          <p className="today-hero-welcome">One connected space.<br />Everything for your next step.</p>
          <div className="today-hero-actions"><button className="button" onClick={openSearch}><Search size={17} />Find something</button><button className="text-button" onClick={() => navigate("actions")}>My Actions<ArrowRight size={17} /></button></div>
           <div className="today-hero-meta">
              <span className="hero-data-note"><Activity size={15} /> Campus workspace · connected data and actions</span>
           </div>
        </div>
        <div className="today-hero-art" aria-hidden="true">
          <svg viewBox="0 0 300 190" role="presentation">
            <path d="M14 147h272" />
            <path d="M34 121 91 74l43 31 53-57 76 64" />
            <path d="M45 121v26M91 74v73M134 105v42M187 48v99M263 112v35" />
            <path d="m34 121 11 9 11-9M80 74l11 9 11-9M123 105l11 9 11-9M176 48l11 9 11-9M252 112l11 9 11-9" />
            <circle cx="91" cy="74" r="9" /><circle cx="187" cy="48" r="9" /><circle cx="263" cy="112" r="9" />
            <rect x="117" y="121" width="34" height="26" rx="2" /><rect x="158" y="101" width="38" height="46" rx="2" />
          </svg>
          <div className="hero-art-label"><ShieldCheck size={15} /> private account boundary</div>
        </div>
      </section>
      <CampusQuickActions />
      </div>
       <div className="today-focus-grid"><div className="today-notice reveal"><LiveContent kind="notice" endpoint="/api/academics" /></div><CampusTimeline /></div>
      <div className="today-grid">
        <div className="today-primary">
          <section className="events-section reveal">
             <SectionHeading eyebrow="PUBLISHED CAMPUS EVENTS" title="Good things, coming up." action="All events" onAction={() => navigate("events")} />
             <LiveEventsCollection query="" category="All events" />
          </section>
          <section className="resources-section reveal">
             <SectionHeading eyebrow="PUBLISHED CAMPUS RESOURCES" title="Your learning toolkit." action="Resource Hub" onAction={() => navigate("resources")} />
             <LiveResources />
          </section>
          <AccountWorkspace />
        </div>
        <aside className="today-rail" aria-label="Account and campus tools">
         <div className="today-transport reveal"><TodayTransportCard /></div>
          <ActionsSummary />
          <GettingStartedCard />
        </aside>
      </div>
      <footer className="campus-page-footer">
        <span>Built around your campus day.</span>
         <span>{CAMPUS_CONCEPT_LABEL} · Connected workspace</span>
      </footer>
    </div>
  );
}
