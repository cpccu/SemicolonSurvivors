import Link from "next/link";

export default function NotFound() {
  return (
    <main className="campus-state">
      <p className="campus-state__eyebrow">Page not found</p>
      <h1>This page isn’t on the campus map.</h1>
      <p>The link may have changed. Return to Today to find your next step.</p>
      <Link href="/" className="campus-state__action">Back to Today</Link>
    </main>
  );
}
