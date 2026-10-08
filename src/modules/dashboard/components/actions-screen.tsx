"use client";

import { useState } from "react";
import { ArrowRight, ArrowUpRight, Bookmark, CheckCheck } from "lucide-react";
import { useCampus } from "@/components/layout/campus-context";
import { EmptyState } from "@/components/ui/primitives";
import { events, resources } from "@/modules/campus/data/fixtures";

export function ActionsScreen() {
  const { saved, openDetail, navigate } = useCampus();
  const [tab, setTab] = useState("Saved items");
  const savedItems = [...events.map((item) => ({ ...item, kind: "event" as const })), ...resources.map((item) => ({ ...item, kind: "resource" as const }))].filter((item) => saved.includes(item.id));
  return <div className="module-page">
    <div className="module-page-header"><div><p className="eyebrow">A LITTLE LESS TO KEEP IN YOUR HEAD</p><h1>My Actions<span>.</span></h1><p>Your bookmarks and a starting point for connected workflows.</p></div><CheckCheck size={34} strokeWidth={1.3} /></div>
    <div className="filter-tabs actions-tabs">{["Saved items", "Live workflows"].map((value) => <button key={value} className={tab === value ? "is-active" : ""} aria-pressed={tab === value} onClick={() => setTab(value)}>{value}{value === "Saved items" && saved.length > 0 && <span className="tab-count">{saved.length}</span>}</button>)}</div>
    {tab === "Saved items" ? savedItems.length ? <div className="saved-items">{savedItems.map((item) => <button className="saved-item" key={item.id} onClick={() => openDetail({ kind: item.kind, id: item.id })}><Bookmark size={22} /><span><small>{item.kind === "event" ? "Event" : "Resource"}</small><strong>{item.title}</strong><span>Saved for this session</span></span><ArrowUpRight size={19} /></button>)}<p className="small-note">Saved items are session-only. The underlying event and resource actions remain account-gated.</p></div> : <EmptyState icon={Bookmark} title="Save something for later." action="Explore events" onAction={() => navigate("events")}>Save an event or resource from its detail view, and it will be easy to find here in this session.</EmptyState> : <div className="action-requests-empty">
      <p className="detail-intro">Open a connected workflow to see its durable status, receipt, ticket, claim, or submission outcome.</p>
      <div className="action-workflow-links"><button className="button button--secondary" onClick={() => navigate("events")}>Events & registrations<ArrowRight size={16} /></button><button className="button button--secondary" onClick={() => navigate("lost-found")}>Lost & found reports<ArrowRight size={16} /></button><button className="button button--secondary" onClick={() => navigate("complaints")}>Support tickets<ArrowRight size={16} /></button><button className="button button--secondary" onClick={() => navigate("services")}>Forms & services<ArrowRight size={16} /></button></div>
    </div>}
  </div>;
}
