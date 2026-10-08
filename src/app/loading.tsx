export default function Loading() {
  return (
    <main className="campus-state" aria-busy="true">
      <div className="loading-skeleton" aria-hidden="true"><span className="skeleton loading-skeleton__line loading-skeleton__line--wide" /><span className="skeleton loading-skeleton__line" /><span className="skeleton loading-skeleton__line loading-skeleton__line--short" /></div>
      <p role="status">Loading your campus view…</p>
    </main>
  );
}
