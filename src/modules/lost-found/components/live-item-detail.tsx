"use client";
import { useState } from "react";
import { z } from "zod";
import { Dialog } from "@/components/ui/dialog";
import { useCampusSession } from "@/lib/auth/use-campus-session";
import { claimSchema, itemSchema } from "@/modules/community/models";
import { communityRequest, failureMessage } from "@/modules/community/client";
import { LoadState, Photo, useCommunityLoad } from "@/modules/community/components/live-shared";

const detailSchema = z.object({ item: itemSchema, claims: z.array(claimSchema), suggestions: z.array(z.object({ item: itemSchema, reasons: z.array(z.string()), score: z.number() })), suggestionMethod: z.string() });
export function LiveItemDetail({ itemId, onClose }: { itemId: string; onClose: () => void }) {
  const result = useCommunityLoad(`/api/lost-found/${itemId}`, detailSchema); const { session } = useCampusSession();
  const [busy, setBusy] = useState(false); const [message, setMessage] = useState("");
  const item = result.data?.item; const user = session?.account?.userId; const own = item?.owner_id === user;
  const transition = async (action: string, claimId?: string) => {
    if (!item) return; setBusy(true); setMessage("");
    try { await communityRequest(`/api/lost-found/${itemId}`, z.object({ item: itemSchema }), { method: "PATCH", data: { version: item.version, action, claimId: claimId ?? null } }); setMessage("Item state saved."); result.reload(); } catch (error) { setMessage(failureMessage(error)); } finally { setBusy(false); }
  };
  return <Dialog open onClose={onClose} title={item?.title ?? "Campus item"} description="Matching suggestions are not proof. Evidence is visible only to the claimant and the person who posted the item."><LoadState loading={result.loading} error={result.error} />{item && <><Photo id={item.photo_id} description={item.title} /><p>{item.kind} · {item.state} · {item.location} · {item.occurred_on}</p><p>{item.description}</p>
    {!own && item.state === "open" && !result.data?.claims.some((claim) => claim.claimant_id === user) && <form className="support-draft-form" onSubmit={async (event) => {
      event.preventDefault(); const evidence = new FormData(event.currentTarget).get("evidence"); setBusy(true); setMessage("");
      try { await communityRequest(`/api/lost-found/${itemId}/claims`, z.object({ claim: claimSchema }), { data: { evidence } }); setMessage("Private claim saved. A suggestion does not establish ownership."); result.reload(); } catch (error) { setMessage(failureMessage(error)); } finally { setBusy(false); }
    }}><label>Private identifying evidence<textarea className="form-input" name="evidence" minLength={20} maxLength={2000} required rows={4} /></label><button className="button button--primary" disabled={busy}>Send private claim</button></form>}
    <h3>Claims you may access</h3>{!result.data?.claims.length && <p>No authorized claims to display.</p>}{result.data?.claims.map((claim) => <article className="detail-source" key={claim.id}><p>{claim.state}</p><p>{claim.evidence}</p>{own && claim.state === "pending" && item.state === "open" && <div className="detail-actions"><button className="button button--primary" disabled={busy} onClick={() => void transition("accept", claim.id)}>Approve handover to this claimant</button><button className="button button--secondary" disabled={busy} onClick={() => void transition("reject", claim.id)}>Reject claim</button></div>}{claim.claimant_id === user && claim.state === "accepted" && item.state === "handover" && <button className="button button--primary" disabled={busy} onClick={() => { if (window.confirm("Confirm the item was physically handed over? This resolves the report.")) void transition("confirm-handover", claim.id); }}>Confirm completed handover</button>}</article>)}
    {own && item.state === "open" && <button className="button button--secondary" disabled={busy} onClick={() => { if (window.confirm("Withdraw this report and reject pending claims?")) void transition("withdraw"); }}>Withdraw report</button>}
    <h3>Possible opposite-kind matches</h3><p>{result.data?.suggestionMethod}</p>{!result.data?.suggestions.length && <p>No explainable suggestions from the current candidate set.</p>}{result.data?.suggestions.map((suggestion) => <article className="detail-source" key={suggestion.item.id}><strong>{suggestion.item.title}</strong><p>{suggestion.item.location} · {suggestion.item.occurred_on}</p><ul>{suggestion.reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul><p>Compare details before making a private claim. This is not AI verification.</p></article>)}
  </>}{message && <p role="status">{message}</p>}</Dialog>;
}
