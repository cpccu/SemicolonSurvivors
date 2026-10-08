"use client";
import { useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { useCampusSession } from "@/lib/auth/use-campus-session";
import { capabilitiesSchema } from "@/modules/content/models";
import { useLiveQuery, useContentSessionRevision } from "@/modules/content/use-live-query";
import { resourcePageSchema, type ResourceRow } from "../models";
import { ResourceForm } from "./resource-form";
import { LiveResourceDetail } from "./live-resource-detail";

export function LiveResources() {
  const sessionRevision = useContentSessionRevision(); return <ResourceWorkspace key={sessionRevision} />;
}
function ResourceWorkspace() {
  const { session } = useCampusSession(); const caps = useLiveQuery("/api/content/capabilities", capabilitiesSchema);
  const [query, setQuery] = useState(""); const [filters, setFilters] = useState({ department: "", course: "", semester: "", category: "" });
  const [mode, setMode] = useState("browse"); const [offset, setOffset] = useState(0); const [revision, setRevision] = useState(0);
  const [selected, setSelected] = useState<ResourceRow | null>(null); const [editing, setEditing] = useState(false);
  const active = session?.account?.status === "active";
  const moderatorScope = session?.assurance === "aal2" ? caps.data?.moderatorScopes[0] : undefined;
  const params = new URLSearchParams({ q: query, offset: String(offset), mine: String(mode === "mine"), review: String(mode === "review") });
  for (const [key, value] of Object.entries(filters)) if (value) params.set(key, value);
  const page = useLiveQuery(`/api/resources?${params}`, resourcePageSchema, revision);
  function changed() { setSelected(null); setEditing(false); setRevision((value) => value + 1); }
  return <section className="live-content" aria-label="Persisted resource hub"><div className="content-section-heading"><div><p className="eyebrow">PERSISTED CAMPUS CONTENT</p><h2>Resource hub</h2></div>
    {active && <button className="button button--primary" onClick={() => { setSelected(null); setEditing(true); }}>Share a resource</button>}</div>
    <p className="small-note">Real community uploads. Private files are owner-only. TXT previews are safe text; PDFs are download-only. No malware scanner is installed.</p>
    <div className="content-toolbar"><label>Search live resources<input maxLength={100} value={query} onChange={(event) => { setQuery(event.target.value); setOffset(0); }} /></label>
      {Object.entries(filters).map(([key, value]) => <label key={key}>{key.charAt(0).toUpperCase() + key.slice(1)}<input maxLength={key === "department" ? 100 : key === "semester" ? 40 : 80} value={value} onChange={(event) => { setFilters((previous) => ({ ...previous, [key]: event.target.value })); setOffset(0); }} /></label>)}
      {active && <label>View<select value={mode} onChange={(event) => { setMode(event.target.value); setOffset(0); }}><option value="browse">Available resources</option><option value="mine">My uploads & cleanup</option>{moderatorScope && <option value="review">Moderation review</option>}</select></label>}</div>
    {page.loading && <p role="status">Loading persisted resources…</p>}{page.error && <div className="content-error" role="alert"><p>{page.error}</p><button className="button button--secondary" onClick={() => setRevision((value) => value + 1)}>Retry</button></div>}
    {page.data && !page.data.items.length && <p className="content-empty">No persisted resources match these filters.</p>}
    <div className="content-list">{page.data?.items.map((item) => <button key={item.id} className="content-list-row" onClick={() => { setSelected(item); setEditing(false); }}><small>{item.course || item.department || "Community resource"} · {item.category} · {item.upload_state}</small>
      <strong>{item.title}</strong><span>{item.description}</span><small>Community · {item.publisher_name} · {item.visibility} · {item.mime_type ?? "Pending file"}</small></button>)}</div>
    <div className="content-actions">{offset > 0 && <button className="button button--secondary" disabled={page.loading} onClick={() => setOffset(Math.max(0, offset - 20))}>Previous page</button>}
      {page.data?.nextOffset != null && <button className="button button--secondary" onClick={() => setOffset(page.data!.nextOffset!)}>Next page</button>}</div>
    {!active && <p className="small-note">Sign in with an active campus account to upload or report resources.</p>}
    <Dialog open={!!selected || editing} title={editing ? selected ? "Edit resource metadata" : "Share a resource" : selected?.title ?? "Resource"} onClose={() => { setSelected(null); setEditing(false); }} className="content-dialog">
      {editing && active ? <ResourceForm initial={selected ?? undefined} onSaved={changed} /> : selected && <LiveResourceDetail key={`${selected.id}-${selected.version}`} item={selected} owner={selected.owner_id === session?.account?.userId} moderatorScope={moderatorScope} onEdit={() => setEditing(true)} onChanged={changed} />}
    </Dialog>
  </section>;
}
