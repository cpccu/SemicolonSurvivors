"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowUpRight, LogOut, ShieldCheck } from "lucide-react";
import { useCampus } from "./campus-context";

export function AccountActions() {
  const { session, openAuth, signOut } = useCampus();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!session?.authenticated || !session.account) {
    return <button className="header-sign-in" aria-haspopup="dialog" onClick={openAuth}><span>Sign in</span> <ArrowUpRight size={16} /></button>;
  }
  async function leaveAccount() {
    setPending(true); setError(null);
    try { await signOut(); }
    catch { setError("Sign-out failed. Please retry."); }
    finally { setPending(false); }
  }
  const pendingAccount = session.account.status === "pending";
  return <div className="account-actions">
    <Link className="header-sign-in" href={pendingAccount ? "/auth/password" : "/auth/security"} aria-label={pendingAccount ? "Finish account setup" : "Account security"}>
      <ShieldCheck size={16} /><span>{pendingAccount ? "Finish setup" : "Account security"}</span>
    </Link>
    <button className="icon-button account-sign-out" onClick={() => void leaveAccount()} disabled={pending} aria-label={pending ? "Signing out" : "Sign out"}><LogOut size={18} /></button>
    {error && <p className="account-action-error" role="alert">{error}</p>}
  </div>;
}
