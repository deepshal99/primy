/**
 * scheduleSnapshot — new-artifact 404 retry.
 *
 * A snapshot fired right after an AI op creates a brand-new entity can 404,
 * because the server only learns about the entity via the debounced project
 * save (~2s later). The scheduler must retry the 404 a couple of times so the
 * first version isn't silently lost — and must give up (with one warning)
 * rather than retry forever.
 */
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { scheduleSnapshot, _resetSnapshotScheduler } from "@/lib/snapshots/scheduler";

describe("scheduleSnapshot — new-artifact 404 retry", () => {
  beforeEach(() => {
    _resetSnapshotScheduler();
    // The scheduler is a no-op server-side (typeof window === "undefined").
    (globalThis as any).window = {};
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    delete (globalThis as any).window;
    delete (globalThis as any).fetch;
  });

  test("retries a 404 then succeeds, with no warning", async () => {
    const responses = [
      { ok: false, status: 404 },
      { ok: true, status: 200 },
    ];
    const fetchMock = vi.fn(() => Promise.resolve(responses.shift()));
    (globalThis as any).fetch = fetchMock;
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    scheduleSnapshot({ type: "ku", id: "newId", content: { docContent: [] } });

    await vi.advanceTimersByTimeAsync(0);
    expect(fetchMock).toHaveBeenCalledTimes(1); // initial POST

    await vi.advanceTimersByTimeAsync(3000); // ride out the retry delay
    expect(fetchMock).toHaveBeenCalledTimes(2); // retry succeeded
    expect(warn).not.toHaveBeenCalled();
  });

  test("gives up after the retry budget and warns exactly once", async () => {
    const fetchMock = vi.fn(() => Promise.resolve({ ok: false, status: 404 }));
    (globalThis as any).fetch = fetchMock;
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    scheduleSnapshot({ type: "ku", id: "ghost", content: { docContent: [] } });

    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(3000);
    await vi.advanceTimersByTimeAsync(3000);

    expect(fetchMock).toHaveBeenCalledTimes(3); // 1 initial + 2 retries
    expect(warn).toHaveBeenCalledTimes(1);
  });

  test("does not retry a non-404 failure", async () => {
    const fetchMock = vi.fn(() => Promise.resolve({ ok: false, status: 500 }));
    (globalThis as any).fetch = fetchMock;
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    scheduleSnapshot({ type: "ku", id: "boom", content: { docContent: [] } });

    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(6000);

    expect(fetchMock).toHaveBeenCalledTimes(1); // 500 is terminal
    expect(warn).toHaveBeenCalledTimes(1);
  });
});
