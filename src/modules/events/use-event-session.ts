"use client";

import { useSyncExternalStore } from "react";
import { createBrowserAuthClient } from "@/lib/auth/browser";
import { createSessionEpoch } from "./session-epoch";

const epoch = createSessionEpoch();
let subscriptions = 0;
let stopWatching: (() => void) | undefined;

function startWatching() {
  const refresh = () => epoch.invalidate();
  let wasHidden = document.hidden;
  const onVisibility = () => {
    if (document.hidden) { wasHidden = true; return; }
    if (wasHidden) { wasHidden = false; refresh(); }
  };
  window.addEventListener("campus-session-changed", refresh);
  // Returning from another tab refreshes identity; camera permission prompts must not reset the scanner.
  document.addEventListener("visibilitychange", onVisibility);
  let unsubscribeAuth: (() => void) | undefined;
  try {
    const auth = createBrowserAuthClient().auth.onAuthStateChange((event) => {
      if (event !== "INITIAL_SESSION") refresh();
    });
    unsubscribeAuth = () => auth.data.subscription.unsubscribe();
  } catch { /* API reads still fail closed when browser auth configuration is unavailable. */ }
  return () => {
    window.removeEventListener("campus-session-changed", refresh);
    document.removeEventListener("visibilitychange", onVisibility);
    unsubscribeAuth?.();
  };
}

function subscribe(listener: () => void) {
  const unsubscribe = epoch.subscribe(listener);
  subscriptions += 1;
  if (subscriptions === 1) stopWatching = startWatching();
  return () => {
    unsubscribe(); subscriptions -= 1;
    if (!subscriptions) { stopWatching?.(); stopWatching = undefined; }
  };
}

// A changed key discards private state and ignores old in-flight responses rather than relabeling them.
export function useEventSessionRevision() {
  return useSyncExternalStore(subscribe, epoch.getSnapshot, () => 0);
}
