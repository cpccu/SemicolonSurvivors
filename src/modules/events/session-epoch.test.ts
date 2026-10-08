import { describe, expect, it, vi } from "vitest";
import { createSessionEpoch } from "./session-epoch";

describe("event session invalidation", () => {
  it("invalidates all snapshots synchronously so previous-user views can be unmounted", () => {
    const epoch = createSessionEpoch();
    const first = vi.fn(() => epoch.getSnapshot());
    const second = vi.fn(() => epoch.getSnapshot());
    epoch.subscribe(first); epoch.subscribe(second);
    const old = epoch.getSnapshot();
    epoch.invalidate();
    expect(epoch.getSnapshot()).not.toBe(old);
    expect(first.mock.results[0]?.value).toBe(1);
    expect(second.mock.results[0]?.value).toBe(1);
  });
  it("does not notify disposed views and changes the key on every invalidation", () => {
    const epoch = createSessionEpoch();
    const listener = vi.fn();
    const dispose = epoch.subscribe(listener);
    dispose(); epoch.invalidate(); epoch.invalidate();
    expect(listener).not.toHaveBeenCalled();
    expect(epoch.getSnapshot()).toBe(2);
  });
});
