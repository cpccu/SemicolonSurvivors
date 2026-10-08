"use client";
import { useState } from "react";
import { z } from "zod";
import { useCampusSession } from "@/lib/auth/use-campus-session";
import { preferencesSchema } from "@/modules/community/models";
import { communityRequest, failureMessage } from "@/modules/community/client";
import { LoadState, useCommunityLoad } from "@/modules/community/components/live-shared";

const resultSchema = z.object({ preferences: preferencesSchema.nullable() });
const split = (value: string) => value.split(",").map((part) => part.trim()).filter(Boolean);
export function ProfilePreferences() {
  const { session } = useCampusSession();
  if (session?.account?.status !== "active") return <p>Sign in to save optional course, section, club, and interest preferences. Preferences never change your student ID, department, or permissions.</p>;
  return <PreferencesForm />;
}
function PreferencesForm() {
  const result = useCommunityLoad("/api/directory/preferences", resultSchema);
  const [message, setMessage] = useState(""); const [busy, setBusy] = useState(false);
  return <section className="detail-section"><h3>Your discovery preferences</h3><p>Comma-separated choices personalize discovery. These are preferences, not verified academic enrollment.</p><LoadState loading={result.loading} error={result.error} />{result.data && <form key={result.data.preferences?.updated_at ?? "new"} className="support-draft-form" onSubmit={async (event) => {
    event.preventDefault(); const data = new FormData(event.currentTarget); setBusy(true); setMessage("");
    try { await communityRequest("/api/directory/preferences", resultSchema, { method: "PUT", data: { interests: split(String(data.get("interests"))), courses: split(String(data.get("courses"))), clubs: split(String(data.get("clubs"))), section: String(data.get("section")), savedRouteId: result.data?.preferences?.saved_route_id ?? null } }); setMessage("Preferences saved."); result.reload(); } catch (error) { setMessage(failureMessage(error)); } finally { setBusy(false); }
  }}>{(["interests", "courses", "clubs"] as const).map((field) => <label key={field}>{field}<input className="form-input" name={field} maxLength={1600} defaultValue={result.data?.preferences?.[field].join(", ") ?? ""} /></label>)}<label>Preferred section<input className="form-input" name="section" maxLength={80} defaultValue={result.data.preferences?.section ?? ""} /></label><button className="button button--primary" disabled={busy}>{busy ? "Saving…" : "Save preferences"}</button></form>}{message && <p role="status">{message}</p>}</section>;
}
