"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { z } from "zod";
import { useCampusSession } from "@/lib/auth/use-campus-session";
import { directorySchema, routeSchema } from "@/modules/community/models";
import { communityRequest, failureMessage } from "@/modules/community/client";
import { LoadState, Provenance, useCommunityLoad } from "@/modules/community/components/live-shared";

const accessSchema = z.object({
  access: z.unknown(), institutionId: z.uuid(),
  directoryDrafts: z.array(directorySchema), routeDrafts: z.array(routeSchema),
});
const directoryResponse = z.object({ entry: directorySchema });
const routeResponse = z.object({ route: routeSchema });
const adminResponse = z.object({ applied: z.literal(true), targetUserId: z.uuid(), action: z.string() });
const clubSchema = z.object({ id: z.uuid(), name: z.string(), description: z.string(), created_at: z.string() });
const lookupSchema = z.object({
  profiles: z.array(z.object({
    userId: z.uuid(), fullName: z.string(), studentId: z.string().nullable(), department: z.string().nullable(),
  })),
  clubs: z.array(clubSchema),
});
const clubResponse = z.object({ club: clubSchema });

export function LiveAdministration() {
  const { session } = useCampusSession();
  const result = useCommunityLoad("/api/administration", accessSchema);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  if (session?.account?.status !== "active") return null;
  const assignments = session.account.assignments;
  const system = session.assurance === "aal2" && Boolean(result.data?.institutionId) && assignments.some((assignment) =>
    assignment.role === "system_admin" && assignment.scope.kind === "institution" && assignment.scope.id === result.data?.institutionId,
  );

  const publish = async (kind: "directory" | "transport", data: unknown, id: string | null, version: number | null) => {
    setBusy(true); setMessage("");
    try {
      if (kind === "directory") await communityRequest("/api/administration/directory", directoryResponse, { data: { id, version, data } });
      else await communityRequest("/api/administration/transport", routeResponse, { data: { id, version, data } });
      setMessage(`${kind} record reviewed and saved.`); result.reload();
    } catch (error) { setMessage(failureMessage(error)); } finally { setBusy(false); }
  };

  const changeIdentity = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    setBusy(true); setMessage("");
    try {
      await communityRequest("/api/administration/identity", adminResponse, {
        data: {
          action: values.get("action"), targetUserId: values.get("targetUserId"), reason: values.get("reason"),
          data: values.get("action") === "status"
            ? { status: values.get("status") }
            : { role: values.get("role"), scopeKind: values.get("scopeKind"), scopeId: values.get("scopeId") },
        },
      });
      setMessage("Identity or role change applied and audited.");
      // Keep the form reference before the await; currentTarget is not reliable after an async boundary.
      form.reset();
      result.reload();
    } catch (error) { setMessage(failureMessage(error)); } finally { setBusy(false); }
  };

  return <section className="detail-section">
    <div className="section-heading"><div><p className="eyebrow">Scoped administration</p><h2>Review and publish campus information</h2></div><button className="text-button" onClick={result.reload}>Refresh workspace</button></div>
    <p>Publishing is scoped to assigned offices/routes and requires MFA. Moderators can review public community records but do not receive private complaint access. Role and account status actions require the exact configured institution system administrator, MFA, and never allow self-promotion.</p>
    <LoadState loading={result.loading} error={result.error} />
    {message && <p role="status">{message}</p>}
    {result.data && <>
      <p>Configured institution: {result.data.institutionId}</p>
      <h3>Current assignments</h3>
      <ul>{assignments.map((assignment) => <li key={`${assignment.role}:${assignment.scope.kind}:${assignment.scope.id}`}>{assignment.role} · {assignment.scope.kind} · {assignment.scope.id}</li>)}</ul>
      {result.data.directoryDrafts.length ? <ReviewDirectory entries={result.data.directoryDrafts} onPublish={publish} busy={busy} /> : <p>No unpublished directory records in your authorized scopes.</p>}
      {result.data.routeDrafts.length ? <ReviewRoutes routes={result.data.routeDrafts} onPublish={publish} busy={busy} /> : <p>No unpublished route records in your authorized scopes.</p>}
      {system && <SystemAdministrationControls currentUserId={session.account.userId} busy={busy} setBusy={setBusy} setMessage={setMessage} onUpdated={result.reload} />}
      {system && <form className="support-draft-form" onSubmit={changeIdentity}>
        <h3>Other audited identity and role controls</h3>
        <p>Use these general controls for status and non-club assignments. Do not target your own account. Club organizer changes use the safer picker above.</p>
        <label>Target user UUID<input className="form-input" name="targetUserId" required /></label>
        <label>Action<select className="form-input" name="action" defaultValue="status"><option value="status">Change account status</option><option value="grant-role">Grant scoped role</option><option value="revoke-role">Revoke scoped role</option></select></label>
        <label>Status (status action)<select className="form-input" name="status" defaultValue="active"><option>active</option><option>suspended</option><option>deactivated</option></select></label>
        <label>Role (role action)<select className="form-input" name="role" defaultValue="moderator"><option value="academic_publisher">Academic publisher</option><option value="transport_editor">Transport editor</option><option value="support_staff">Support staff</option><option value="moderator">Moderator</option><option value="enrollment_admin">Enrollment admin</option><option value="system_admin">System admin</option></select></label>
        <label>Scope kind (role action)<select className="form-input" name="scopeKind" defaultValue="institution"><option value="institution">Institution</option><option value="department">Department</option><option value="course">Course</option><option value="section">Section</option><option value="route">Route</option><option value="office">Office</option></select></label>
        <label>Scope UUID (role action)<input className="form-input" name="scopeId" required /></label>
        <label>Reason<textarea className="form-input" name="reason" minLength={10} maxLength={500} required /></label>
        <button className="button button--primary" disabled={busy}>Apply audited change</button>
      </form>}
    </>}
  </section>;
}

function SystemAdministrationControls({ currentUserId, busy, setBusy, setMessage, onUpdated }: { currentUserId: string; busy: boolean; setBusy: (value: boolean) => void; setMessage: (value: string) => void; onUpdated: () => void }) {
  const [query, setQuery] = useState("");
  const [lookupQuery, setLookupQuery] = useState("");
  const lookup = useCommunityLoad(`/api/administration/lookup?query=${encodeURIComponent(lookupQuery)}`, lookupSchema);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [selectedClubId, setSelectedClubId] = useState("");

  const selectableProfiles = lookup.data?.profiles.filter((profile) => profile.userId !== currentUserId) ?? [];
  const activeSelectedUserId = selectableProfiles.some((profile) => profile.userId === selectedUserId) ? selectedUserId : "";
  const activeSelectedClubId = lookup.data?.clubs.some((club) => club.id === selectedClubId) ? selectedClubId : "";

  const changeClubOrganizer = async (action: "grant-role" | "revoke-role") => {
    if (!activeSelectedUserId || !activeSelectedClubId) { setMessage("Choose an active user and a club first."); return; }
    setBusy(true); setMessage("");
    try {
      await communityRequest("/api/administration/identity", adminResponse, {
        data: { action, targetUserId: activeSelectedUserId, reason: "Club organizer assignment managed from the administration picker.", data: { role: "club_organizer", scopeKind: "club", scopeId: activeSelectedClubId } },
      });
      setMessage(`Club organizer ${action === "grant-role" ? "grant" : "revocation"} applied and audited.`);
      lookup.reload(); onUpdated();
    } catch (error) { setMessage(failureMessage(error)); } finally { setBusy(false); }
  };

  const createClub = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    setBusy(true); setMessage("");
    try {
      const response = await communityRequest("/api/administration/clubs", clubResponse, { data: { name: values.get("clubName"), description: values.get("clubDescription") } });
      form.reset(); setSelectedClubId(response.club.id); setMessage("Club created and audited."); lookup.reload(); onUpdated();
    } catch (error) { setMessage(failureMessage(error)); } finally { setBusy(false); }
  };

  return <section className="support-draft-form" aria-labelledby="system-admin-tools">
    <h3 id="system-admin-tools">Club administration</h3>
    <p>Only the configured institution system administrator with a current AAL2 session can use these controls. Results are bounded to active profiles and clubs; email and other private identity fields are never returned.</p>
    <p><Link href="/auth/enrollment">Add a user via enrollment</Link> · Review the approved roster there. This does not enable SMTP or provision arbitrary production accounts.</p>
    <form onSubmit={(event) => { event.preventDefault(); setLookupQuery(query.trim()); }}>
      <label>Find active user<input className="form-input" value={query} onChange={(event) => setQuery(event.target.value)} maxLength={80} placeholder="Name, student ID, or department" /></label>
      <button className="button button--secondary" disabled={busy}>Find users</button>
    </form>
    <LoadState loading={lookup.loading} error={lookup.error} />
    {lookup.data && <>
      <label>Select active user<select className="form-input" value={activeSelectedUserId} onChange={(event) => setSelectedUserId(event.target.value)} required>
        <option value="">Choose a user</option>{selectableProfiles.map((profile) => <option key={profile.userId} value={profile.userId}>{profile.fullName}{profile.studentId ? ` · ${profile.studentId}` : ""}{profile.department ? ` · ${profile.department}` : ""}</option>)}
      </select></label>
      {!selectableProfiles.length && <p>No eligible active profiles matched that search.</p>}
      <label>Select club<select className="form-input" value={activeSelectedClubId} onChange={(event) => setSelectedClubId(event.target.value)} required>
        <option value="">Choose a club</option>{lookup.data.clubs.map((club) => <option key={club.id} value={club.id}>{club.name}</option>)}
      </select></label>
      {!lookup.data.clubs.length && <p>No clubs exist yet. Create one below.</p>}
      <div className="detail-actions"><button type="button" className="button button--primary" disabled={busy || !activeSelectedUserId || !activeSelectedClubId} onClick={() => changeClubOrganizer("grant-role")}>Grant club organizer</button><button type="button" className="button button--secondary" disabled={busy || !activeSelectedUserId || !activeSelectedClubId} onClick={() => changeClubOrganizer("revoke-role")}>Revoke club organizer</button></div>
    </>}
    <form onSubmit={createClub}>
      <h4>Create a club</h4>
      <label>Club name<input className="form-input" name="clubName" minLength={2} maxLength={160} required /></label>
      <label>Description<textarea className="form-input" name="clubDescription" maxLength={5000} /></label>
      <button className="button button--secondary" disabled={busy}>Create and audit club</button>
    </form>
  </section>;
}

function ReviewDirectory({ entries, onPublish, busy }: { entries: z.infer<typeof directorySchema>[]; onPublish: (kind: "directory", data: unknown, id: string, version: number) => void; busy: boolean }) {
  return <><h3>Directory review queue</h3>{entries.map((entry) => <article className="detail-source" key={entry.id}><h4>{entry.title}</h4><p>{entry.state} · version {entry.version} · {entry.visibility}</p><p>{entry.description}</p><Provenance record={entry} /><button className="button button--secondary" disabled={busy} onClick={() => onPublish("directory", { kind: entry.kind, title: entry.title, description: entry.description, location: entry.location, contact: entry.contact, sourceLabel: entry.source_label, sourceUrl: entry.source_url, reviewedAt: entry.reviewed_at, visibility: entry.visibility, state: "published" }, entry.id, entry.version)}>Publish reviewed record</button></article>)}</>;
}

function ReviewRoutes({ routes, onPublish, busy }: { routes: z.infer<typeof routeSchema>[]; onPublish: (kind: "transport", data: unknown, id: string, version: number) => void; busy: boolean }) {
  return <><h3>Transport review queue</h3>{routes.map((route) => <article className="detail-source" key={route.id}><h4>{route.title}</h4><p>{route.state} · version {route.version} · {route.stops.length} stops</p><p>{route.notice}</p><Provenance record={route} /><button className="button button--secondary" disabled={busy} onClick={() => onPublish("transport", { title: route.title, stops: route.stops, schedules: route.schedules, exceptions: route.exceptions, notice: route.notice, sourceLabel: route.source_label, sourceUrl: route.source_url, reviewedAt: route.reviewed_at, visibility: route.visibility, state: "published" }, route.id, route.version)}>Publish reviewed timetable</button></article>)}</>;
}
