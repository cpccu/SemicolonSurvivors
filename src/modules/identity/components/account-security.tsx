"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ShieldCheck } from "lucide-react";
import { CityUniversityLogo } from "@/components/branding/city-university-logo";
import { CAMPUS_INSTITUTION_LABEL } from "@/lib/branding";
import { useCampusSession } from "@/lib/auth/use-campus-session";
import { useMfaWorkflow } from "../use-mfa-workflow";
import type { TotpFactor } from "../mfa-schemas";
import { TotpSetupDetails } from "./totp-setup-details";
import { TotpVerificationForm } from "./totp-verification-form";
import { MfaRemovalDialog } from "./mfa-removal-dialog";

function MfaManagement({ onSignedOut }: { onSignedOut: () => void }) {
  const flow = useMfaWorkflow(onSignedOut);
  const setup = flow.setup;
  const challenge = flow.challenge;
  const [removing, setRemoving] = useState<TotpFactor | null>(null);
  const status = useRef<HTMLParagraphElement>(null);
  useEffect(() => { if (!removing && (flow.error || flow.message)) status.current?.focus(); }, [flow.error, flow.message, removing]);
  return <>
    {(flow.error || flow.message) && <p ref={status} tabIndex={-1} className={flow.error ? "identity-error" : "identity-status"} role={flow.error ? "alert" : "status"}>{flow.error || flow.message}</p>}
    {flow.busy && <p role="status">Checking with managed Auth…</p>}
    {flow.state && <><div className="mfa-assurance"><strong>Current managed session: {flow.state.currentLevel}</strong><p>{flow.state.freshMfa ? "Recent MFA proof is available; the server rechecks it before removal." : "Removal requires a new MFA verification within the last five minutes."}</p></div>
      <h2>Your authenticators</h2>
      {flow.state.factors.length === 0 ? <p>No TOTP authenticator is listed for this account.</p> : <ul className="mfa-factor-list">{flow.state.factors.map((factor) => <li key={factor.id}><div><strong>{factor.friendlyName}</strong><span>{factor.status === "verified" ? "Verified authenticator" : "Unverified setup — a code is still required"}</span></div><div className="identity-actions"><button type="button" className="button button--secondary" disabled={flow.busy} onClick={() => flow.startChallenge(factor.id)}>{factor.status === "verified" ? "Verify this session" : "Verify pending setup"}</button><button type="button" className="text-button" disabled={flow.busy || flow.uncertain || !flow.state?.freshMfa} onClick={() => setRemoving(factor)}>Remove</button></div></li>)}</ul>}
      {flow.state.factors.some((factor) => factor.status === "unverified") && !flow.setup && <p>A pending setup already exists. If it is in your authenticator, verify its code. The original key cannot be redisplayed here. If you lost it, use an institution-verified account recovery process; this page will not silently replace or remove it.</p>}
      {flow.state.hasOtherVerifiedFactors && <p>Other verified MFA factors protect this account. Adding or verifying a pending TOTP factor requires a recent managed MFA step-up first.</p>}
      <div className="identity-actions"><button type="button" className="button button--primary" disabled={flow.busy || flow.uncertain || !!flow.setup || !flow.state.canEnroll} onClick={flow.enroll}>Set up authenticator</button><button type="button" className="button button--secondary" disabled={flow.busy} onClick={flow.refresh}>Reload factor status</button></div>
    </>}
    {!flow.state && !flow.busy && <button type="button" className="button button--secondary" onClick={flow.refresh}>Retry factor lookup</button>}
    {setup && <TotpSetupDetails setup={setup} busy={flow.busy} onHide={flow.hideSetup} onContinue={() => flow.startChallenge(setup.factorId)} />}
    {challenge && <TotpVerificationForm key={challenge.challengeId} challenge={challenge} busy={flow.busy} onVerify={flow.verify} onRestart={() => flow.startChallenge(challenge.factorId)} />}
    {removing && <MfaRemovalDialog key={removing.id} factor={removing} busy={flow.busy} blocked={flow.uncertain} error={flow.error} onClose={() => setRemoving(null)} onRemove={() => flow.remove(removing.id)} />}
  </>;
}

export function AccountSecurity() {
  const { session, loading, error } = useCampusSession();
  const [signedOut, setSignedOut] = useState(false);
  const active = session?.authenticated && session.account?.status === "active";
  return <main className="identity-page"><Link href="/" className="identity-brand"><span>CampusOS</span><span className="identity-brand-institution"><span className="identity-brand-logo-frame"><CityUniversityLogo className="identity-brand-logo" priority /></span><small>{CAMPUS_INSTITUTION_LABEL}</small></span></Link><section className="identity-panel mfa-panel">
    <div className="identity-heading"><span className="identity-mark" aria-hidden="true"><ShieldCheck size={26} strokeWidth={1.5} /></span><div><p className="eyebrow">Account security</p><h1>Authenticator &amp; staff verification</h1></div></div><p className="identity-intro">An active approved profile is required. Staff roles do not grant MFA assurance: managed Auth must verify your authenticator code before privileged campus actions become available.</p>
    {signedOut ? <p className="identity-status" role="status">The authenticator was removed and this browser session was signed out. Sign in again to continue.</p> : <>
      {loading && !session && <p role="status">Checking your approved account…</p>}
      {error && <p className="identity-error" role="alert">{error}</p>}
      {!loading && !active && <p className="identity-error" role="alert">{session?.readiness.signInAvailable === false ? "Identity access is unavailable until the hosted identity schema is ready." : "Sign in with an active approved account to manage its authenticator."}</p>}
      {active && session.account && <MfaManagement key={session.account.userId} onSignedOut={() => setSignedOut(true)} />}
    </>}
    <div className="identity-actions"><Link href="/">Return to campus</Link>{active && !signedOut && <Link href="/auth/enrollment">Enrollment workspace</Link>}</div>
  </section></main>;
}
