"use client";
import { useState } from "react";
import { z } from "zod";
import { useCampusSession } from "@/lib/auth/use-campus-session";
import { Dialog } from "@/components/ui/dialog";
import { itemSchema } from "@/modules/community/models";
import { LoadState, Pager, Photo, useCommunityLoad } from "@/modules/community/components/live-shared";
import { ItemReportForm } from "./item-report-form";
import { LiveItemDetail } from "./live-item-detail";

const listSchema = z.object({ items: z.array(itemSchema), page: z.number(), hasMore: z.boolean() });
export function LiveLostFound({ reportOpen, onReportOpenChange }: { reportOpen?: boolean; onReportOpenChange?: (open: boolean) => void } = {}) {
  const { session } = useCampusSession();
  const [query, setQuery] = useState(""); const [kind, setKind] = useState(""); const [page, setPage] = useState(1);
  const [localReport, setLocalReport] = useState(false); const [selected, setSelected] = useState<string | null>(null);
  const report = reportOpen ?? localReport;
  const setReport = (open: boolean) => onReportOpenChange ? onReportOpenChange(open) : setLocalReport(open);
  const parameters = new URLSearchParams({ query, page: String(page) }); if (kind) parameters.set("kind", kind);
  const result = useCommunityLoad(`/api/lost-found?${parameters}`, listSchema);
  return <section className="detail-section"><div className="section-heading"><div><p className="eyebrow">Persistent campus reports</p><h2>Lost and found collection</h2></div><button className="button button--primary" disabled={session?.account?.status !== "active"} onClick={() => setReport(true)}>Post an item with a photo</button></div><p>Active campus accounts only. Keep ID numbers, faces, contact details, and identifying proof out of public descriptions and photos. Ownership evidence belongs in a private claim.</p><div className="collection-toolbar"><label>Search posted titles<input className="form-input" value={query} maxLength={120} onChange={(event) => { setQuery(event.target.value); setPage(1); }} /></label><label>Report type<select className="form-input" value={kind} onChange={(event) => { setKind(event.target.value); setPage(1); }}><option value="">Lost and found</option><option value="lost">Lost</option><option value="found">Found</option></select></label><button className="text-button" onClick={result.reload}>Refresh reports</button></div><LoadState loading={result.loading} error={result.error} />
    {result.data && <>{!result.data.items.length && <p>No campus reports match this view. You can post a lost or found item with an uploaded photo.</p>}<div className="lost-found-grid">{result.data.items.map((item) => <article className="detail-source" key={item.id}><Photo id={item.photo_id} description={item.title} /><p>{item.kind} · {item.state}</p><h3>{item.title}</h3><p>{item.location} · {item.occurred_on}</p><button className="button button--secondary" onClick={() => setSelected(item.id)}>Item details and private claims</button></article>)}</div><Pager page={page} hasMore={result.data.hasMore} onPage={setPage} /></>}
    <Dialog open={report} onClose={() => setReport(false)} title="Post a lost or found item" description="Your uploaded image and description will be visible to active campus accounts."><ItemReportForm onSaved={(id) => { setReport(false); result.reload(); setSelected(id); }} /></Dialog>
    {selected && <LiveItemDetail itemId={selected} onClose={() => { setSelected(null); result.reload(); }} />}
  </section>;
}
