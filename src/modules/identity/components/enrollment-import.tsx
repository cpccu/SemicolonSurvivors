"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { z } from "zod";
import { CityUniversityLogo } from "@/components/branding/city-university-logo";
import { CAMPUS_INSTITUTION_LABEL } from "@/lib/branding";
import { useCampusSession } from "@/lib/auth/use-campus-session";
import { getIdentity, postIdentity } from "../client-api";
import { ENROLLMENT_MAX_BYTES, enrollmentTemplate, parseEnrollmentInput, serializeEnrollmentPayload, type EnrollmentFormat, type EnrollmentIssue } from "../enrollment-parser";
import { importReportSchema, recentImportsSchema, type ImportReport, type SessionView } from "../schemas";
import styles from "./enrollment-import.module.css";

const confirmationResponse = z.strictObject({ report: importReportSchema, emailRequested: z.boolean(), processingComplete: z.boolean() });
type AccessState = "loading" | "signed-out" | "pending" | "inactive" | "missing-role" | "aal1" | "ready";

function accessState(session: SessionView | null, loading: boolean): AccessState {
  if (loading) return "loading";
  if (!session?.authenticated || !session.account) return "signed-out";
  if (session.account.status === "pending") return "pending";
  if (session.account.status !== "active") return "inactive";
  if (!session.account.assignments.some((assignment) => assignment.role === "enrollment_admin" && assignment.scope.kind === "institution")) return "missing-role";
  if (session.assurance !== "aal2") return "aal1";
  return "ready";
}

function reasonLabel(reason: ImportReport["records"][number]["reason"]) {
  return reason === "identity_conflict" ? "Existing identity differs" : reason === "duplicate_in_batch" ? "Repeated in this import" : "";
}

function resultLabel(result: ImportReport["records"][number]["result"]) {
  return result === "new" ? "New identity" : result === "unchanged" ? "No changes" : "Needs review";
}

function authLabel(status: ImportReport["records"][number]["authStatus"]) {
  return { pending: "Account will remain pending", provisioned: "Account prepared", already_active: "Account already active", conflict: "Account not changed" }[status];
}

function emailLabel(status: ImportReport["records"][number]["emailStatus"]) {
  return { not_requested: "No invitation requested", in_flight: "Invitation processing", sent: "Invitation accepted for delivery", failed: "Invitation failed", uncertain: "Delivery needs reconciliation", not_required: "Invitation not required" }[status];
}

function issueLabel(issue: EnrollmentIssue) {
  return `${issue.row ? `Row ${issue.row}${issue.field ? `, ${issue.field}` : ""}: ` : ""}${issue.message}`;
}

function accessCopy(state: AccessState) {
  return {
    "signed-out": <>Sign in with an approved institutional account first. <Link href="/?signin=1">Return to sign in</Link>.</>,
    pending: <>Your account is awaiting institutional approval. Contact your campus administrator when your status should change.</>,
    inactive: <>This account is inactive for enrollment work. Contact your campus administrator for an approved account.</>,
    "missing-role": <>Your account is active, but it has no institution-scoped enrollment administrator assignment. Ask an administrator to grant the role; this page cannot grant it.</>,
    aal1: <>A recent authenticator verification is required before enrollment work. <Link href="/auth/security">Open account security</Link> to verify MFA.</>,
    loading: <>Checking your approved enrollment access…</>,
    ready: <>Your approved enrollment workspace is ready.</>,
  }[state];
}

export function EnrollmentImport() {
  const { session, loading, error: sessionError } = useCampusSession();
  const [format, setFormat] = useState<EnrollmentFormat>("csv");
  const [source, setSource] = useState("");
  const [sourceOwner, setSourceOwner] = useState<string | null>(null);
  const [issues, setIssues] = useState<EnrollmentIssue[]>([]);
  const [report, setReport] = useState<ImportReport | null>(null);
  const [reportOwner, setReportOwner] = useState<string | null>(null);
  const [recent, setRecent] = useState<z.infer<typeof recentImportsSchema> | null>(null);
  const [recentOwner, setRecentOwner] = useState<string | null>(null);
  const [sendInvitations, setSendInvitations] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const requestNumber = useRef(0);
  const controller = useRef<AbortController | null>(null);
  const state = accessState(session, loading);
  const permitted = state === "ready";
  const ownerId = session?.account?.userId ?? null;
  const identityKey = `${session?.authenticated ? "authenticated" : "anonymous"}:${ownerId ?? ""}`;
  const reportKey = identityKey;
  const activeReport = reportOwner === reportKey ? report : null;
  const activeRecent = recentOwner === reportKey ? recent : null;
  const canRequestInvitations = session?.readiness.emailAvailable === true;

  useEffect(() => () => controller.current?.abort(), []);
  useEffect(() => {
    controller.current?.abort();
    requestNumber.current += 1;
  }, [reportKey]);

  function resetSource(value: string, nextFormat = format) {
    controller.current?.abort();
    requestNumber.current += 1;
    setPending(false); setSource(value); setSourceOwner(reportKey); setFormat(nextFormat); setReport(null); setIssues([]); setError(null); setMessage(null); setRecent(null);
  }

  function chooseFormat(nextFormat: EnrollmentFormat) {
    if (nextFormat !== format) resetSource(source, nextFormat);
  }

  async function readFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    try { resetSource(await file.text()); }
    catch { setError("The selected file could not be read. Try pasting its contents instead."); }
    event.target.value = "";
  }

  async function preview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!permitted) return;
    const parsed = parseEnrollmentInput(source, format);
    setReport(null); setMessage(null); setError(null); setIssues(parsed.ok ? [] : parsed.issues);
    if (!parsed.ok) return;
    try { serializeEnrollmentPayload(parsed.rows); }
    catch (failure) { setIssues([{ message: failure instanceof Error ? failure.message : "This import is too large to send." }]); return; }
    const id = ++requestNumber.current;
    controller.current?.abort(); controller.current = new AbortController();
    setPending(true);
    try {
      const next = await postIdentity("/api/enrollment/imports/preview", { rows: parsed.rows }, importReportSchema, { maxBytes: ENROLLMENT_MAX_BYTES, signal: controller.current.signal });
      if (id === requestNumber.current) { setReport(next); setReportOwner(reportKey); }
    } catch (failure) {
      if (id === requestNumber.current && !(failure instanceof DOMException && failure.name === "AbortError")) setError(failure instanceof Error ? failure.message : "The roster could not be previewed.");
    } finally { if (id === requestNumber.current) setPending(false); }
  }

  async function confirm() {
    if (!activeReport || activeReport.state !== "staged" || !permitted) return;
    const id = ++requestNumber.current;
    controller.current?.abort(); controller.current = new AbortController();
    setPending(true); setError(null); setMessage(null);
    try {
      const result = await postIdentity("/api/enrollment/imports/confirm", { batchId: activeReport.batchId, sendInvitations: sendInvitations && canRequestInvitations }, confirmationResponse, { signal: controller.current.signal });
      if (result.report.state !== "confirmed") throw new Error("The saved roster is not ready to report as confirmed. Refresh and try again.");
      if (id === requestNumber.current) {
        setReport(result.report); setReportOwner(reportKey); setMessage(result.processingComplete ? "The roster was saved. Review each outcome below; invitation acceptance is not proof of delivery." : "The roster was saved, but invitation processing is incomplete. Review outcomes and reconcile exceptions before retrying.");
      }
    } catch (failure) {
      if (id === requestNumber.current && !(failure instanceof DOMException && failure.name === "AbortError")) setError(failure instanceof Error ? failure.message : "Confirmation could not be completed.");
    } finally { if (id === requestNumber.current) setPending(false); }
  }

  async function reviewSaved(batchId?: string) {
    const id = ++requestNumber.current;
    controller.current?.abort(); controller.current = new AbortController();
    setPending(true); setError(null); setMessage(null); setIssues([]);
    try {
      if (batchId) {
        const next = await getIdentity(`/api/enrollment/imports/${encodeURIComponent(batchId)}`, importReportSchema, { signal: controller.current.signal });
        if (id === requestNumber.current) { setReport(next); setReportOwner(reportKey); }
      } else {
        const next = await getIdentity("/api/enrollment/imports", recentImportsSchema, { signal: controller.current.signal });
        if (id === requestNumber.current) { setRecent(next); setRecentOwner(reportKey); }
      }
    } catch (failure) {
      if (id === requestNumber.current && !(failure instanceof DOMException && failure.name === "AbortError")) setError(failure instanceof Error ? failure.message : "Saved imports could not be loaded.");
    } finally { if (id === requestNumber.current) setPending(false); }
  }

  const templateHref = `data:text/csv;charset=utf-8,${encodeURIComponent(enrollmentTemplate())}`;
  return <main className={styles.page}>
     <Link className={styles.brand} href="/"><span className={styles.product}>CampusOS</span><span className={styles.institution}><span className={styles.logoFrame}><CityUniversityLogo className={styles.logo} priority /></span><small>{CAMPUS_INSTITUTION_LABEL}</small></span></Link>
    <section className={styles.panel}>
      <div className={styles.intro}><p className={styles.eyebrow}>Scoped enrollment workspace</p><h1>Import approved enrollments</h1><p>Bring a synthetic or campus-approved CSV/JSON source into a private review. This workflow stages at most 50 rows, checks every field locally, and only saves after you confirm.</p></div>
      <div className={styles.steps} aria-label="Enrollment import steps"><div className={`${styles.step} ${styles.stepActive}`}><strong>1 · Upload</strong><span>Choose CSV or JSON</span></div><div className={`${styles.step} ${activeReport ? styles.stepActive : ""}`}><strong>2 · Review</strong><span>Inspect each outcome</span></div><div className={`${styles.step} ${activeReport?.state === "confirmed" ? styles.stepActive : ""}`}><strong>3 · Confirm</strong><span>Save the approved roster</span></div></div>
      {sessionError && <p className={styles.error} role="alert">{sessionError}</p>}
      <div className={styles.access} role={state === "ready" || state === "loading" ? undefined : "alert"}>{accessCopy(state)}{state === "ready" && <span> Exact institution scope is checked by the server.</span>}</div>
      {message && <p className={styles.success} role="status">{message}</p>}
      {error && <p className={styles.error} role="alert">{error}</p>}
      {permitted && <form onSubmit={preview}>
        <div className={styles.sourceGrid}>
          <section className={styles.sourceCard}><h2>Choose a source</h2><p>Use a local file or paste content. The source stays in this browser until you submit a preview.</p><div className={styles.choice} role="group" aria-label="Source format"><label><input type="radio" name="format" checked={format === "csv"} onChange={() => chooseFormat("csv")} /> CSV</label><label><input type="radio" name="format" checked={format === "json"} onChange={() => chooseFormat("json")} /> JSON</label></div><label className={styles.inputLabel} htmlFor="enrollment-file">Upload local {format.toUpperCase()} file</label><input id="enrollment-file" type="file" accept={format === "csv" ? ".csv,text/csv" : ".json,application/json"} onChange={readFile} disabled={pending} /><a className={styles.template} href={templateHref} download="enrollment-template.csv">Download synthetic CSV template</a></section>
          <section className={styles.sourceCard}><label className={styles.inputLabel} htmlFor="enrollment-source">Paste {format.toUpperCase()} source</label><p>{format === "csv" ? "Header must be exactly studentId,email,fullName,department,batch. Quoted commas and line breaks are supported." : "Use { rows: [{ studentId, email, fullName, department, batch }] } with no extra fields."}</p><textarea id="enrollment-source" className={styles.source} value={sourceOwner === reportKey ? source : ""} maxLength={ENROLLMENT_MAX_BYTES} onChange={(event) => resetSource(event.target.value)} disabled={pending} required spellCheck={false} autoComplete="off" /></section>
        </div>
        {issues.length > 0 && <ul className={styles.issues} role="alert">{issues.map((issue, index) => <li key={`${issue.row ?? "source"}-${issue.field ?? "value"}-${index}`}>{issueLabel(issue)}</li>)}</ul>}
        <div className={styles.toolbar}><span className={styles.muted}>Source limit: {ENROLLMENT_MAX_BYTES.toLocaleString()} UTF-8 bytes · maximum 50 rows</span><button className={`${styles.button} ${styles.primary}`} disabled={pending}>{pending ? "Working…" : "Review source"}</button></div>
      </form>}
      {activeReport && <section className={styles.review} aria-labelledby="review-heading"><h2 id="review-heading">{activeReport.state === "confirmed" ? "Saved roster outcomes" : "Review before confirmation"}</h2><p className={styles.muted}>{activeReport.state === "staged" ? "This review is temporary and expires after one hour. Conflicts must be resolved before saving." : "These outcomes came from the persisted confirmation response."}</p><div className={styles.tableWrap}><table className={styles.table}><caption className="sr-only">Enrollment import outcomes</caption><thead><tr><th>Student record</th><th>Import result</th><th>Account</th><th>Invitation</th></tr></thead><tbody>{activeReport.records.map((record) => <tr key={record.rowNumber}><td><strong>{record.rowNumber}. {record.studentId}</strong><br />{record.fullName}<br /><span className={styles.muted}>{record.email}<br />{record.department} · {record.batch}</span></td><td>{resultLabel(record.result)}{record.reason && <><br /><span className={styles.muted}>{reasonLabel(record.reason)}</span></>}</td><td>{authLabel(record.authStatus)}</td><td>{emailLabel(record.emailStatus)}</td></tr>)}</tbody></table></div>{activeReport.state === "staged" && <><label className={styles.check}><input type="checkbox" checked={sendInvitations && canRequestInvitations} onChange={(event) => setSendInvitations(event.target.checked)} disabled={!canRequestInvitations || pending} /><span>{canRequestInvitations ? "Also request managed invitation emails. Delivery is attempted separately and reported per row." : "Invitation emails are disabled by server configuration. Roster-only confirmation remains available."}</span></label><div className={styles.actions}><button className={`${styles.button} ${styles.primary}`} type="button" disabled={pending || activeReport.records.some((record) => record.result === "conflict")} onClick={confirm}>{pending ? "Confirming…" : "Confirm approved roster"}</button></div></>}</section>}
      <section className={styles.recent}><div className={styles.toolbar}><div><h2>Recent imports</h2><p className={styles.muted}>Retrieve only batches visible in your institution scope.</p></div><button className={`${styles.button} ${styles.secondary}`} type="button" disabled={!permitted || pending} onClick={() => reviewSaved()}>Load recent imports</button></div>{activeRecent && (activeRecent.length === 0 ? <p className={styles.muted}>No imports in this institution scope yet.</p> : <ul>{activeRecent.map((entry) => <li key={entry.batchId}><button className={styles.recent} type="button" disabled={pending} onClick={() => reviewSaved(entry.batchId)}>{new Date(entry.createdAt).toLocaleString("en-GB", { timeZone: "Asia/Dhaka" })} (Dhaka) — {entry.state}</button></li>)}</ul>)}</section>
      <div className={styles.securityLinks}><Link href="/auth/security">Account security</Link><Link href="/">Return to campus</Link></div>
    </section>
  </main>;
}
