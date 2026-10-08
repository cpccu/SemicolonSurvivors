"use client";
import { useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { useCampusSession } from "@/lib/auth/use-campus-session";
import { capabilitiesSchema, contentPageSchema, type ContentKind, type ContentRow } from "../models";
import { useLiveQuery, useContentSessionRevision } from "../use-live-query";
import { ContentForm } from "./content-form";
import { ContentDetail } from "./content-detail";

const headings: Record<ContentKind, string> = { notice: "Published academic notices", article: "Approved campus knowledge", service: "Reviewed forms & services" };
export function LiveContent({ kind, endpoint }: { kind: ContentKind; endpoint: string }) {
  const sessionRevision = useContentSessionRevision();
  return <ContentWorkspace key={sessionRevision} kind={kind} endpoint={endpoint} />;
}
function ContentWorkspace({ kind, endpoint }: { kind: ContentKind; endpoint: string }) {
  const { session } = useCampusSession(); const [revision, setRevision] = useState(0);
  const [query, setQuery] = useState(""); const [audience, setAudience] = useState(""); const [category, setCategory] = useState("");
  const [offset, setOffset] = useState(0); const [manage, setManage] = useState(false);
  const [selected, setSelected] = useState<ContentRow | null>(null); const [editing, setEditing] = useState(false);
  const caps = useLiveQuery("/api/content/capabilities", capabilitiesSchema);
  const canPublish = session?.assurance === "aal2" && session.account?.status === "active" && !!caps.data?.publishAudiences.length;
  const params = new URLSearchParams({ q: query, offset: String(offset), manage: String(manage && canPublish) });
  if (audience) params.set("audience", audience); if (category) params.set("category", category);
  const page = useLiveQuery(`${endpoint}?${params}`, contentPageSchema, revision);
  function changed() { setSelected(null); setEditing(false); setRevision((value) => value + 1); }
  return <section className="live-content" aria-label={headings[kind]}>
    <div className="content-section-heading"><div><p className="eyebrow">PERSISTED CAMPUS CONTENT</p><h2>{headings[kind]}</h2></div>
      {canPublish && <button className="button button--primary" onClick={() => { setSelected(null); setEditing(true); }}>Create {kind}</button>}</div>
    <p className="small-note">Campus audiences use institutional department mapping and verified course/section membership. Preferences are not proof of enrollment.</p>
    <div className="content-toolbar"><label>Search published {kind === "article" ? "knowledge" : kind === "service" ? "services" : "notices"}<input maxLength={100} value={query} onChange={(event) => { setQuery(event.target.value); setOffset(0); }} /></label>
      <label>Audience<select value={audience} onChange={(event) => { setAudience(event.target.value); setOffset(0); }}><option value="">All permitted audiences</option>{caps.data?.audiences.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
      <label>Category<input maxLength={80} value={category} onChange={(event) => { setCategory(event.target.value); setOffset(0); }} /></label>
      {canPublish && <label className="content-checkbox"><input type="checkbox" checked={manage} onChange={(event) => { setManage(event.target.checked); setOffset(0); }} />Manage drafts & archives</label>}
    </div>
    {page.loading && <p role="status">Loading persisted content…</p>}
    {page.error && <div className="content-error" role="alert"><p>{page.error}</p><button className="button button--secondary" onClick={() => setRevision((value) => value + 1)}>Retry</button></div>}
    {page.data && !page.data.items.length && <p className="content-empty">No published {kind === "notice" ? "notices" : kind === "article" ? "articles" : "services"} match these filters.</p>}
    <div className="content-list">{page.data?.items.map((item) => <button key={item.id} className="content-list-row" onClick={() => { setSelected(item); setEditing(false); }}>
       <small>{item.category} · Published · {item.status}</small><strong>{item.title}</strong><span>{item.body.slice(0, 180)}</span>
      <small>{item.publisher_name} · Revision {item.version} · Updated {new Date(item.updated_at).toLocaleDateString("en-GB", { timeZone: "Asia/Dhaka" })}</small>
      {kind === "service" && <small>{item.closes_at ? `Closes ${new Date(item.closes_at).toLocaleDateString("en-GB", { timeZone: "Asia/Dhaka" })}` : "No published closing date"} · External form</small>}
    </button>)}</div>
    <div className="content-actions">{offset > 0 && <button className="button button--secondary" disabled={page.loading} onClick={() => setOffset(Math.max(0, offset - 20))}>Previous page</button>}
      {page.data?.nextOffset != null && <button className="button button--secondary" onClick={() => setOffset(page.data!.nextOffset!)}>Next page</button>}</div>
    {session?.account?.assignments.some((assignment) => assignment.role === "academic_publisher") && session.assurance !== "aal2" && <p className="small-note">Verify staff MFA in Account security to publish or correct content.</p>}
    <Dialog open={!!selected || editing} onClose={() => { setSelected(null); setEditing(false); }} title={editing ? `${selected ? "Edit" : "Create"} ${kind}` : selected?.title ?? "Content"} className="content-dialog">
      {editing && canPublish ? <ContentForm key={selected?.id ?? "new"} kind={kind} endpoint={endpoint} audiences={caps.data?.publishAudiences ?? []} initial={selected ?? undefined} onSaved={changed} />
        : selected && <ContentDetail key={selected.id} item={selected} endpoint={endpoint} audience={caps.data?.audiences.find((item) => item.id === selected.audience_id)?.label}
          canEdit={!!canPublish && !!caps.data?.publishAudiences.some((item) => item.id === selected.audience_id)} onEdit={() => setEditing(true)} onChange={changed} />}
    </Dialog>
  </section>;
}
