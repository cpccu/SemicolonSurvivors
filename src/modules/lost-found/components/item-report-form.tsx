"use client";
import { useState } from "react";
import { z } from "zod";
import { communityRequest, failureMessage, uploadPhoto } from "@/modules/community/client";
import { itemSchema } from "@/modules/community/models";

export function ItemReportForm({ onSaved }: { onSaved: (id: string) => void }) {
  const [busy, setBusy] = useState(false); const [message, setMessage] = useState(""); const [uploaded, setUploaded] = useState<string | null>(null);
  return <form className="support-draft-form" onSubmit={async (event) => {
    event.preventDefault(); const fields = new FormData(event.currentTarget); setBusy(true); setMessage("");
    try {
      let photoId = uploaded; const file = fields.get("photo");
      if (!photoId) { if (!(file instanceof File) || !file.size) throw new Error("Upload a PNG photo before posting."); photoId = await uploadPhoto(file, "item"); setUploaded(photoId); }
      const result = await communityRequest("/api/lost-found", z.object({ item: itemSchema }), { data: { kind: fields.get("kind"), title: fields.get("title"), description: fields.get("description"), location: fields.get("location"), occurredOn: fields.get("date"), photoId } });
      onSaved(result.item.id);
    } catch (error) { setMessage(failureMessage(error)); } finally { setBusy(false); }
  }}><label>Type<select className="form-input" name="kind"><option value="lost">Lost</option><option value="found">Found</option></select></label><label>Item title<input className="form-input" name="title" required minLength={3} maxLength={120} /></label><label>Description<textarea className="form-input" name="description" required minLength={15} maxLength={2000} rows={4} /></label><label>Reported location<input className="form-input" name="location" required minLength={2} maxLength={200} /></label><label>Date lost or found<input className="form-input" name="date" type="date" required /></label><label>Item photo · PNG only<input className="form-input" name="photo" type="file" accept="image/png" required={!uploaded} onChange={() => setUploaded(null)} /></label><p className="field-helper">Up to 3 MiB, 2048 × 2048 pixels. Non-interlaced 8-bit RGB/RGBA PNG; metadata is removed server-side. Crop out faces and IDs first. Never submit ownership proof in the listing.</p>{uploaded && <p>Photo uploaded privately. Posting has not yet completed.</p>}{message && <p role="alert">{message}</p>}<button className="button button--primary" disabled={busy}>{busy ? "Uploading and posting…" : "Post campus report"}</button></form>;
}
