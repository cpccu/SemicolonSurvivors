"use client";

import { useCallback, useEffect, useState } from "react";
import { sessionSchema, type SessionView } from "@/modules/identity/schemas";
import { notifySessionChanged, postIdentity } from "@/modules/identity/client-api";
import { z } from "zod";

export function useCampusSession(enabled = true, initialSession: SessionView | null = null) {
  const [session, setSession] = useState<SessionView | null>(initialSession);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const refresh = useCallback(() => setRevision((value) => value + 1), []);

  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    const load = async () => {
      setLoading(true);
      try {
        const response = await fetch("/api/auth/session", {
          credentials: "same-origin", cache: "no-store", signal: controller.signal,
        });
        const parsed = sessionSchema.safeParse(await response.json());
        if (!response.ok || !parsed.success) throw new Error("Account status is temporarily unavailable.");
        setSession(parsed.data); setError(null);
      } catch {
        if (!controller.signal.aborted) { setSession(null); setError("Account status is temporarily unavailable."); }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };
    void load();
    const onFocus = () => refresh();
    window.addEventListener("campus-session-changed", refresh);
    window.addEventListener("focus", onFocus);
    return () => {
      controller.abort();
      window.removeEventListener("campus-session-changed", refresh);
      window.removeEventListener("focus", onFocus);
    };
  }, [enabled, revision, refresh]);

  const signOut = useCallback(async () => {
    await postIdentity("/api/auth/sign-out", {}, z.strictObject({ signedOut: z.literal(true) }));
    notifySessionChanged();
  }, []);

  return { session, loading, error, refresh, signOut };
}
