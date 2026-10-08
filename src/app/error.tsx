"use client";

import Link from "next/link";

type ErrorBoundaryProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function ErrorBoundary({ reset }: ErrorBoundaryProps) {
  return (
    <main className="campus-state" role="alert">
      <p className="campus-state__eyebrow">Something went wrong</p>
      <h1>We couldn’t load this page.</h1>
      <p>Try again. If the problem continues, return to Today.</p>
      <button type="button" className="campus-state__action" onClick={reset}>Try again</button>
      <Link href="/">Back to Today</Link>
    </main>
  );
}
