"use client";

import Link from "next/link";
import { useRef, useState, type FormEvent } from "react";
import { ArrowRight, BookOpen, Check, CircleHelp, Eye, EyeOff, GraduationCap, KeyRound, LockKeyhole, Mail, ShieldCheck, Sparkles, UserRoundCheck } from "lucide-react";
import { z } from "zod";
import { CAMPUS_INSTITUTION_LABEL } from "@/lib/branding";
import { CityUniversityLogo } from "@/components/branding/city-university-logo";
import { claimSchema, resetSchema, sessionSchema, signInSchema, type SessionView } from "@/modules/identity/schemas";
import { notifySessionChanged, postIdentity } from "@/modules/identity/client-api";
import styles from "./account-gateway.module.css";

type AccountView = "sign-in" | "activate" | "reset" | "help";
const messageSchema = z.strictObject({ message: z.string() });
interface AccountGatewayProps {
  session: SessionView;
  checking?: boolean;
  openingCampus?: boolean;
  error?: string | null;
  onRetry: () => void;
  onSignOut: () => Promise<void>;
}

export function AccountGateway({ session, checking = false, openingCampus = false, error: sessionError, onRetry, onSignOut }: AccountGatewayProps) {
  const [view, setView] = useState<AccountView>("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [studentId, setStudentId] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const submitting = useRef(false);
  const ready = session.readiness.signInAvailable && !checking && !sessionError;
  const emailReady = ready && session.readiness.emailAvailable;
  const accountPending = session.authenticated && session.account?.status === "pending";
  const accountDenied = session.authenticated && !accountPending && session.account?.status !== "active";
  const accountState = openingCampus || accountPending || accountDenied;

  function changeView(next: AccountView) {
    if (submitting.current) return;
    setView(next); setError(null); setMessage(null); setPassword(""); setShowPassword(false);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current || (view === "sign-in" ? !ready : !emailReady)) return;
    setError(null); setMessage(null);
    const input = view === "sign-in" ? signInSchema.safeParse({ email, password })
      : view === "activate" ? claimSchema.safeParse({ studentId }) : resetSchema.safeParse({ email });
    if (!input.success) {
      setError(view === "activate" ? "Enter a valid student ID: 3–40 letters, numbers, or hyphens."
        : "Enter a valid approved email address and the required account details.");
      return;
    }
    submitting.current = true; setPending(true);
    try {
      if (view === "sign-in") {
        await postIdentity("/api/auth/sign-in", input.data, sessionSchema);
        notifySessionChanged();
      } else {
        const result = await postIdentity(view === "activate" ? "/api/enrollment/claim" : "/api/auth/password-reset", input.data, messageSchema);
        setMessage(result.message);
      }
    } catch (failure) {
      const failureMessage = failure instanceof Error ? failure.message : "This request could not be completed. Please try again.";
      setError(view === "sign-in" && failureMessage === "This action is not available to your account."
        ? "Campus access is denied for this account. Contact your institution’s enrollment or account support team through a verified campus channel."
        : failureMessage);
    } finally {
      setPassword(""); setShowPassword(false); submitting.current = false; setPending(false);
    }
  }

  async function leaveAccount() {
    if (submitting.current) return;
    submitting.current = true; setPending(true); setError(null);
    try { await onSignOut(); }
    catch (failure) { setError(failure instanceof Error ? failure.message : "Sign-out could not be completed. Please try again."); }
    finally { submitting.current = false; setPending(false); }
  }

  const title = openingCampus ? "Your campus is almost here." : accountPending ? "One more step to get started."
    : accountDenied ? "Campus access is denied." : view === "activate" ? "Make yourself at home."
      : view === "reset" ? "Let’s get you back in." : view === "help" ? "A little help getting in." : "Welcome to your campus.";

  return <main className={styles.gateway}>
      <a className={styles.skipLink} href="#account-access">Skip to account access</a>
      <section className={styles.story} aria-label="About CampusOS">
        <Link href="/" className={styles.brand} aria-label="CampusOS home"><span className={styles.brandIcon}><GraduationCap size={27} strokeWidth={1.6} /></span><span>Campus<span className={styles.brandAccent}>OS</span></span><span className={styles.brandTag}>CAMPUS, CONNECTED</span></Link>
        <span className={styles.institutionLogoFrame}><CityUniversityLogo className={styles.institutionLogo} priority /></span>
      <div className={styles.storyBody}>
        <p className={styles.eyebrow}><span /> {CAMPUS_INSTITUTION_LABEL}</p>
        <h1>Your campus.<br />A little <span>closer.</span></h1>
        <p className={styles.storyIntro}>Less searching. More belonging. One thoughtful place for the information, resources, and support that keep your campus day moving.</p>
         <div className={styles.connectionArt} aria-hidden="true"><svg className={styles.geometryArt} viewBox="0 0 300 210" role="presentation"><path d="M22 159 89 91l44 34 57-75 78 67" /><path d="M22 159h246M89 91v68M133 125v34M190 50v109M268 117v42" /><circle cx="89" cy="91" r="8" /><circle cx="190" cy="50" r="8" /><rect x="119" y="140" width="28" height="19" /><rect x="154" y="119" width="42" height="40" /></svg><div className={styles.artOrbit} /><div className={styles.artOrbitInner} /><div className={styles.artCenter}><GraduationCap size={38} strokeWidth={1.3} /></div><span className={styles.artNodeOne}><BookOpen size={21} /></span><span className={styles.artNodeTwo}><UserRoundCheck size={21} /></span><span className={styles.artNodeThree}><Sparkles size={21} /></span><span className={styles.artDotOne} /><span className={styles.artDotTwo} /><p>A more connected campus day.</p></div>
        <div className={styles.storyPromises}><div><BookOpen size={19} /><span>Information,<br /><strong>within reach.</strong></span></div><div><UserRoundCheck size={19} /><span>Support,<br /><strong>when it matters.</strong></span></div><div><ShieldCheck size={19} /><span>Your space,<br /><strong>kept private.</strong></span></div></div>
      </div>
      <div className={styles.storyFooter}><ShieldCheck size={17} /><p>For approved campus accounts.<br /><span>Campus information stays behind verified access.</span></p></div>
    </section>

    <section className={styles.access} id="account-access" tabIndex={-1} aria-labelledby="access-title">
      <div className={styles.accessTop}><span className={styles.privateBadge}><LockKeyhole size={13} /> PRIVATE CAMPUS SPACE</span><button type="button" className={styles.helpTop} disabled={pending || accountState} onClick={() => changeView("help")}><CircleHelp size={16} /> Need help?</button></div>
      <div className={styles.accessBody}>
        <div className={styles.welcomeIcon}>{accountDenied ? <LockKeyhole size={24} /> : accountPending ? <KeyRound size={24} /> : <GraduationCap size={27} strokeWidth={1.5} />}</div>
        <p className={styles.accessEyebrow}>{accountDenied ? "ACCOUNT ACCESS" : accountPending ? "COMPLETE ACCOUNT SETUP" : openingCampus ? "VERIFIED ACCOUNT" : "GOOD TO HAVE YOU HERE"}</p>
        <h2 id="access-title">{title}</h2>
        <p className={styles.accessIntro}>{openingCampus ? "We’re checking your access and opening your private workspace."
          : accountPending ? "Your approved account needs password setup before campus information becomes available."
            : accountDenied ? "This account does not have active campus access. Your institution must review its status before you can continue."
              : view === "activate" ? "Start with the student ID on your institution’s approved roster."
                : view === "reset" ? "Request password instructions for your approved account email."
                  : view === "help" ? "Your institution’s approved account is the key to CampusOS."
                    : "Sign in with your approved account to pick up your campus day."}</p>

        {!accountState && <nav className={styles.tabs} aria-label="Account access options"><button type="button" aria-pressed={view === "sign-in" || view === "reset"} className={view === "sign-in" || view === "reset" ? styles.activeTab : ""} disabled={pending} onClick={() => changeView("sign-in")}>Sign in</button><button type="button" aria-pressed={view === "activate"} className={view === "activate" ? styles.activeTab : ""} disabled={pending} onClick={() => changeView("activate")}>Activate account</button><button type="button" aria-pressed={view === "help"} className={view === "help" ? styles.activeTab : ""} disabled={pending} onClick={() => changeView("help")}>Get help</button></nav>}

        {checking && !openingCampus && <p className={styles.checking} role="status"><span className={styles.statusDot} /> Checking account access…</p>}
        {(error || sessionError) && <div className={styles.error} role="alert"><p>{error || sessionError}</p>{sessionError && <button type="button" onClick={onRetry}>Try again <ArrowRight size={14} /></button>}</div>}
        {message && <p className={styles.success} role="status"><Check size={17} />{message}</p>}

        {openingCampus && <div className={styles.stateContent}><p role="status" className={styles.checking}><span className={styles.statusDot} /> {checking ? "Verifying your account…" : "Opening your campus…"}</p><button type="button" className={styles.secondaryButton} onClick={onRetry}>Refresh account access <ArrowRight size={16} /></button></div>}
        {accountPending && !openingCampus && <div className={styles.stateContent}><div className={styles.setupStep}><span>01</span><div><strong>Choose your password</strong><p>Finish secure setup using your confirmed invitation or account session.</p></div></div><Link className={styles.primaryButton} href="/auth/password">Continue account setup <ArrowRight size={17} /></Link><button type="button" className={styles.textButton} disabled={pending} onClick={leaveAccount}>{pending ? "Signing out…" : "Sign out and use another account"}</button></div>}
        {accountDenied && <div className={styles.stateContent}><div className={styles.deniedNote}><ShieldCheck size={20} /><p>Contact your institution’s enrollment or account support team through a verified campus channel. Signing in again cannot change an account’s approval status.</p></div><button type="button" className={styles.secondaryButton} disabled={pending} onClick={leaveAccount}>{pending ? "Signing out…" : "Sign out"}<ArrowRight size={17} /></button></div>}

        {!accountState && (view === "sign-in" || view === "reset") && <form className={styles.form} onSubmit={submit} aria-label={view === "sign-in" ? "Sign in to CampusOS" : "Request password reset"}>
          <label htmlFor="campus-entry-email">Approved email address</label><div className={styles.inputWrap}><Mail size={18} /><input id="campus-entry-email" type="email" autoComplete="username" maxLength={254} required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Your campus account email" disabled={!ready || pending} /></div>
          {view === "sign-in" && <><div className={styles.labelRow}><label htmlFor="campus-entry-password">Password</label><button type="button" disabled={pending} onClick={() => changeView("reset")}>Forgot password?</button></div><div className={styles.inputWrap}><LockKeyhole size={18} /><input id="campus-entry-password" type={showPassword ? "text" : "password"} autoComplete="current-password" required maxLength={128} value={password} onChange={(event) => setPassword(event.target.value)} disabled={!ready || pending} /><button type="button" className={styles.revealPassword} disabled={!ready || pending} aria-label={showPassword ? "Hide password" : "Show password"} aria-pressed={showPassword} onClick={() => setShowPassword(!showPassword)}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></div></>}
          <button className={styles.primaryButton} disabled={pending || (view === "sign-in" ? !ready : !emailReady)}>{pending ? "Please wait…" : view === "reset" ? "Request reset instructions" : "Sign in to CampusOS"}<ArrowRight size={18} /></button>
          {view === "reset" && <button type="button" className={styles.textButton} disabled={pending} onClick={() => changeView("sign-in")}>Back to sign in</button>}
          {view === "sign-in" && <p className={styles.formFootnote}><ShieldCheck size={14} /> Your account is checked before campus access opens.</p>}
        </form>}

        {!accountState && view === "activate" && <form className={styles.form} onSubmit={submit} aria-label="Activate an approved campus account"><ol className={styles.activationSteps}><li><span>01</span><p><strong>Match your approved record</strong>Your institution must add your student ID to its roster first.</p></li><li><span>02</span><p><strong>Check your approved email</strong>Instructions go only to the email on that roster.</p></li><li><span>03</span><p><strong>Confirm and choose a password</strong>Opening the email link alone does not activate your account.</p></li></ol><label htmlFor="campus-entry-student-id">Student ID</label><div className={styles.inputWrap}><UserRoundCheck size={18} /><input id="campus-entry-student-id" type="text" autoComplete="off" minLength={3} maxLength={40} required value={studentId} onChange={(event) => setStudentId(event.target.value)} placeholder="Your approved student ID" disabled={!emailReady || pending} /></div><button className={styles.primaryButton} disabled={!emailReady || pending}>{pending ? "Please wait…" : "Request activation instructions"}<ArrowRight size={17} /></button></form>}

        {!accountState && view === "help" && <div className={styles.helpContent}><div><UserRoundCheck size={19} /><section><h3>New to CampusOS?</h3><p>Ask your institution’s enrollment office to confirm your student ID and approved email. Account approval is managed by your institution.</p><button type="button" className={styles.textButton} onClick={() => changeView("activate")}>Activate an approved account <ArrowRight size={15} /></button></section></div><div><KeyRound size={19} /><section><h3>Having trouble signing in?</h3><p>Use your approved email and account password. Recovery instructions are available when email delivery is enabled.</p><button type="button" className={styles.textButton} onClick={() => changeView("reset")}>Reset your password <ArrowRight size={15} /></button></section></div><p className={styles.helpNote}>For account or enrollment corrections, use a verified institutional support channel. CampusOS does not provide public signup or sample login accounts.</p></div>}

        {!accountState && !checking && <div className={styles.readiness} aria-label="Account service status"><div><span className={ready ? styles.readyDot : styles.unavailableDot} /><span>{ready ? "Account sign-in available" : "Account sign-in unavailable"}</span></div><div><span className={emailReady ? styles.readyDot : styles.unavailableDot} /><span>{emailReady ? "Account email delivery enabled" : "Activation & reset email disabled"}</span></div>{!ready ? <p>Account access will open when the configured identity service and database are ready.</p> : !emailReady ? <p>Existing approved accounts can sign in. Activation and password reset are paused until verified email delivery is enabled.</p> : null}</div>}
      </div>
      <footer className={styles.accessFooter}><span>Thoughtfully connected. Securely yours.</span><span>CampusOS</span></footer>
    </section>
  </main>;
}
