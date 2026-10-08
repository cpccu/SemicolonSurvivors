export function createSessionEpoch() {
  let revision = 0;
  const listeners = new Set<() => void>();
  return {
    getSnapshot: () => revision,
    invalidate() { revision += 1; for (const listener of listeners) listener(); },
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
  };
}
