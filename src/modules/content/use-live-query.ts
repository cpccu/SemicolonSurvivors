"use client";
import { useEffect, useState } from "react";
import type { z } from "zod";
import { contentFetch } from "./client";
export { useEventSessionRevision as useContentSessionRevision } from "@/modules/events/use-event-session";

export function useLiveQuery<T>(url: string | null, schema: z.ZodType<T>, revision = 0) {
  const [state, setState] = useState<{ url: string | null; revision: number; data: T | null; error: string | null }>({ url: null, revision: -1, data: null, error: null });
  useEffect(() => {
    if (!url) return;
    const controller = new AbortController();
    void contentFetch(url, schema, { signal: controller.signal }).then((data) => {
      if (!controller.signal.aborted) setState({ url, revision, data, error: null });
    }).catch((error: unknown) => {
      if (!controller.signal.aborted) setState({ url, revision, data: null, error: error instanceof Error ? error.message : "Please try again." });
    });
    return () => controller.abort();
  }, [url, schema, revision]);
  const current = state.url === url && state.revision === revision;
  return { data: current ? state.data : null, error: current ? state.error : null, loading: !!url && (!current || (!state.data && !state.error)) };
}
