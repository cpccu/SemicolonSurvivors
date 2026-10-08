"use client";
import { useState } from "react";
import { z } from "zod";
import { directorySchema } from "@/modules/community/models";
import { LoadState, Pager, Provenance, useCommunityLoad } from "@/modules/community/components/live-shared";
import { ProfilePreferences } from "./profile-preferences";

const listSchema = z.object({ entries: z.array(directorySchema), page: z.number(), hasMore: z.boolean() });
export function LiveDirectory({ query }: { query: string }) {
  const [kind, setKind] = useState(""); const [page, setPage] = useState(1); const [selected, setSelected] = useState("");
  const parameters = new URLSearchParams({ query, page: String(page) }); if (kind) parameters.set("kind", kind);
  const result = useCommunityLoad(`/api/directory?${parameters}`, listSchema);
  return <section className="detail-section"><div className="section-heading"><div><p className="eyebrow">Persistent campus directory</p><h2>Reviewed contacts and fresher guides</h2></div><button className="text-button" onClick={result.reload}>Refresh directory</button></div>
    <label>Directory category<select className="form-input" value={kind} onChange={(event) => { setKind(event.target.value); setPage(1); }}><option value="">All entries</option>{["department", "club", "office", "place", "guide"].map((value) => <option key={value}>{value}</option>)}</select></label>
    <LoadState loading={result.loading} error={result.error} />
    {result.data && <>{!result.data.entries.length && <p>No reviewed entries match this view. Official campus contacts appear only after staff publish a reviewed source.</p>}<div className="resource-list">{result.data.entries.map((entry) => <article key={entry.id} className="detail-source"><small>{entry.kind} · {entry.visibility} · Reviewed source</small><h3><button className="text-button" aria-expanded={selected === entry.id} onClick={() => setSelected(selected === entry.id ? "" : entry.id)}>{entry.title}</button></h3>{selected === entry.id && <><p style={{ whiteSpace: "pre-wrap" }}>{entry.description}</p>{entry.location && <p>Location: {entry.location}</p>}{entry.contact && <p>Approved public campus contact: {entry.contact}</p>}<Provenance record={entry} /></>}</article>)}</div><Pager page={page} hasMore={result.data.hasMore} onPage={setPage} /></>}
    <ProfilePreferences />
  </section>;
}
