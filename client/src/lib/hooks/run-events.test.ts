import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { renderHook, act, cleanup } from "@testing-library/react";

vi.mock("../toast", () => ({ notify: { error: vi.fn() } }));

import { notify } from "../toast";
import { useRunEvents } from "./reviews";

class FakeEventSource {
  static all: FakeEventSource[] = [];
  onmessage: ((ev: MessageEvent) => void) | null = null;
  onerror: (() => void) | null = null;
  onopen: (() => void) | null = null;
  closed = false;
  constructor(public url: string) {
    FakeEventSource.all.push(this);
  }
  addEventListener() {}
  close() {
    this.closed = true;
  }
  emit(data: unknown) {
    this.onmessage?.({ data: JSON.stringify(data) } as MessageEvent);
  }
  fail() {
    this.onerror?.();
  }
  opened() {
    this.onopen?.();
  }
}

beforeEach(() => {
  FakeEventSource.all = [];
  vi.stubGlobal("EventSource", FakeEventSource);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("useRunEvents", () => {
  it("is idle with no run ids", () => {
    const { result } = renderHook(() => useRunEvents([]));
    expect(result.current).toEqual({ events: [], running: false });
    expect(FakeEventSource.all).toHaveLength(0);
  });

  it("streams events per run and stops running when every stream has closed", () => {
    const { result } = renderHook(() => useRunEvents(["r1", "r2"]));
    expect(result.current.running).toBe(true);
    const [a, b] = FakeEventSource.all;
    expect(a!.url).toMatch(/\/runs\/r1\/events$/);

    act(() => a!.emit({ t: "1", kind: "info", msg: "start" }));
    act(() => b!.emit({ t: "2", kind: "error", msg: "boom" }));
    expect(result.current.events.map((e) => e.msg)).toEqual(["start", "boom"]);
    expect(notify.error).toHaveBeenCalledWith("boom");

    act(() => a!.fail());
    expect(result.current.running).toBe(true);
    act(() => b!.fail());
    expect(result.current.running).toBe(false);
    expect(result.current.events).toHaveLength(2);
  });

  it("re-subscribing to runs whose streams already closed counts as running again", () => {
    const { result, rerender } = renderHook(({ ids }) => useRunEvents(ids), { initialProps: { ids: ["r1"] } });
    act(() => FakeEventSource.all[0]!.emit({ t: "1", kind: "info", msg: "first" }));
    act(() => FakeEventSource.all[0]!.fail());
    expect(result.current.running).toBe(false);
    rerender({ ids: ["r1", "r2"] });
    rerender({ ids: ["r1"] });
    act(() => FakeEventSource.all.at(-1)!.opened());
    expect(result.current).toEqual({ events: [], running: true });
  });

  it("switching to other runs closes old streams and starts from an empty log", () => {
    const { result, rerender } = renderHook(({ ids }) => useRunEvents(ids), { initialProps: { ids: ["r1"] } });
    act(() => FakeEventSource.all[0]!.emit({ t: "1", kind: "info", msg: "old" }));
    rerender({ ids: ["r9"] });
    expect(FakeEventSource.all[0]!.closed).toBe(true);
    expect(result.current).toEqual({ events: [], running: true });
  });
});
