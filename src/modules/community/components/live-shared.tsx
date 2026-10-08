"use client";
import { Fragment, useEffect, useState, type ReactNode } from "react";
import { z } from "zod";
import Image from "next/image";
import { campusTime, communityRequest, failureMessage } from "../client";

export function CommunityBoundary({ children }: { children: ReactNode }) {
  const [revision, setRevision] = useState(0);
  useEffect(() => { const clear = () => setRevision((value) => value + 1); window.addEventListener("campus-session-changed", clear); return () => window.removeEventListener("campus-session-changed", clear); }, []);
  return <Fragment key={revision}>{children}</Fragment>;
}
export function useCommunityLoad<T>(url: string, schema: z.ZodType<T>) {
  const [state, setState] = useState<{ key: string; data?: T; error?: string }>({ key: "" });
  const [revision, setRevision] = useState(0);
  const key = `${url}:${revision}`;
  useEffect(() => {
    const controller = new AbortController();
    void communityRequest(url, schema, undefined, controller.signal).then((data) => { if (!controller.signal.aborted) setState({ key: `${url}:${revision}`, data }); }).catch((error: unknown) => { if (!controller.signal.aborted) setState({ key: `${url}:${revision}`, error: failureMessage(error) }); });
    return () => controller.abort();
  }, [url, schema, revision]);
  return { data: state.key === key ? state.data : undefined, error: state.key === key ? state.error : undefined, loading: state.key !== key, reload: () => setRevision((value) => value + 1) };
}
export function LoadState({ loading, error }: { loading: boolean; error: string | undefined }) { return loading ? <p role="status">Loading persisted campus records…</p> : error ? <p role="status">Collection unavailable. {error}</p> : null; }
export function Pager({ page, hasMore, onPage }: { page: number; hasMore: boolean; onPage: (page: number) => void }) { return <div className="detail-actions"><button className="button button--secondary" disabled={page <= 1} onClick={() => onPage(page - 1)}>Previous page</button><span>Page {page}</span><button className="button button--secondary" disabled={!hasMore} onClick={() => onPage(page + 1)}>Next page</button></div>; }
export function Provenance({ record }: { record: { source_label: string; source_url: string; reviewed_at: string; updated_at: string } }) { return <p className="field-helper">Source: <a href={record.source_url} target="_blank" rel="noopener noreferrer">{record.source_label}</a> · Reviewed {campusTime(record.reviewed_at)} · Updated {campusTime(record.updated_at)} · Asia/Dhaka</p>; }
export function Photo({ id, description }: { id: string; description: string }) {
  // Same-origin image endpoint enforces current account and entity access, rather than issuing public URLs.
  return <a href={`/api/community/media/${id}`} target="_blank" rel="noopener noreferrer"><Image src={`/api/community/media/${id}`} alt={description} width={480} height={320} unoptimized style={{ maxWidth: "100%", height: "auto" }} /><span>Open uploaded photo</span></a>;
}
