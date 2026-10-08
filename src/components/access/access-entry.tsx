"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useCampusSession } from "@/lib/auth/use-campus-session";
import type { SessionView } from "@/modules/identity/schemas";
import { AccountGateway } from "./account-gateway";

interface AccessEntryProps {
  initialSession: SessionView;
  initialError?: string | null;
  children?: ReactNode;
}

/** Server-authorized content is usable only by the same, freshly verified account. */
export function AccessEntry({ initialSession, initialError = null, children }: AccessEntryProps) {
  const router = useRouter();
  const { session, loading, error, refresh, signOut } = useCampusSession();
  const [invalidatedSession, setInvalidatedSession] = useState<SessionView | null>(null);
  const requestedSession = useRef<SessionView | null>(null);
  const currentSession = session ?? initialSession;
  const checking = loading || currentSession === invalidatedSession;
  const sessionError = error ?? (session ? null : initialError);
  const active = currentSession.authenticated && currentSession.account?.status === "active";
  const serverGranted = initialSession.authenticated && initialSession.account?.status === "active"
    && initialSession.account.userId === currentSession.account?.userId && Boolean(children);

  useEffect(() => {
    // A sign-out/account-change event invalidates the visible campus immediately,
    // including while useCampusSession is starting its next request.
    const invalidate = () => setInvalidatedSession(currentSession);
    window.addEventListener("campus-session-changed", invalidate);
    window.addEventListener("focus", invalidate);
    return () => {
      window.removeEventListener("campus-session-changed", invalidate);
      window.removeEventListener("focus", invalidate);
    };
  }, [currentSession]);

  useEffect(() => {
    if (checking || sessionError || !active || serverGranted || !session || requestedSession.current === session) return;
    requestedSession.current = session;
    // An anonymous response contains no campus node. Ask the server to authorize
    // and supply it after sign-in; do not mount a dashboard from the login page.
    router.refresh();
  }, [active, checking, router, serverGranted, session, sessionError]);

  if (active && serverGranted && !checking && !sessionError) return children;

  return <AccountGateway
    session={currentSession}
    checking={checking}
    openingCampus={active && !sessionError}
    error={sessionError}
    onRetry={() => { refresh(); router.refresh(); }}
    onSignOut={signOut}
  />;
}
