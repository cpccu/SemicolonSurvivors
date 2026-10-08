"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { MailCheck } from "lucide-react";
import { z } from "zod";
import { CityUniversityLogo } from "@/components/branding/city-university-logo";
import { CAMPUS_INSTITUTION_LABEL } from "@/lib/branding";
import { confirmSchema } from "../schemas";
import { notifySessionChanged, postIdentity } from "../client-api";

export function LinkConfirmation({ tokenHash, type }: { tokenHash: string; type: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const parsed = confirmSchema.safeParse({ tokenHash, type });
  async function confirm() {
    if (!parsed.success || pending) return;
    setPending(true); setError(null);
    try {
      await postIdentity("/api/auth/confirm", parsed.data, z.strictObject({ nextStep: z.literal("set_password") }));
      // Remove the single-use hash from browser history before password setup.
      window.history.replaceState(null, "", "/auth/confirm");
      notifySessionChanged(); router.replace("/auth/password");
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "This link could not be confirmed."); setPending(false);
    }
  }
  return <main className="identity-page"><Link href="/" className="identity-brand"><span>CampusOS</span><span className="identity-brand-institution"><span className="identity-brand-logo-frame"><CityUniversityLogo className="identity-brand-logo" priority /></span><small>{CAMPUS_INSTITUTION_LABEL}</small></span></Link><section className="identity-panel">
    <div className="identity-heading"><span className="identity-mark" aria-hidden="true"><MailCheck size={26} strokeWidth={1.5} /></span><div><p className="eyebrow">Approved campus accounts</p><h1>{type === "recovery" ? "Confirm password recovery" : "Confirm your invitation"}</h1></div></div>
    <p className="identity-intro">Opening this page does not consume your link. Continue only if you requested this email.</p>
    {!parsed.success && <p role="alert" className="identity-error">This link is incomplete or unsupported. Request new instructions through account help.</p>}
    {error && <p role="alert" className="identity-error">{error} If the link has expired or was used, contact enrollment or request a password reset.</p>}
    <button type="button" className="button button--primary" onClick={confirm} disabled={!parsed.success || pending}>{pending ? "Confirming…" : "Confirm and continue"}</button>
    <Link href="/">Return to campus</Link>
  </section></main>;
}
