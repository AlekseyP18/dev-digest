import { describe, it, expect, afterEach, vi } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";

let running = false;
vi.mock("@/lib/hooks/reviews", () => ({
  useRunEvents: () => ({ events: [], running }),
}));

import { RunStatus } from "./RunStatus";
import { namespace } from "@/test/intl";

const messages = namespace("prReview");

afterEach(cleanup);

function ui(onDone?: () => void, runIds = ["run-1"]) {
  return (
    <NextIntlClientProvider locale="en" messages={{ prReview: messages }}>
      <RunStatus runIds={runIds} onDone={onDone} />
    </NextIntlClientProvider>
  );
}

describe("RunStatus", () => {
  it("renders nothing when there are no run ids", () => {
    running = false;
    const { container } = render(ui(undefined, []));
    expect(container.firstChild).toBeNull();
  });

  it("fires onDone once per running → settled transition, not on later re-renders", () => {
    running = true;
    const { rerender } = render(ui(vi.fn()));
    running = false;
    // A new callback identity on every render, like an inline arrow from a parent.
    const calls: ReturnType<typeof vi.fn>[] = [];
    for (let i = 0; i < 4; i++) {
      const cb = vi.fn();
      calls.push(cb);
      rerender(ui(cb));
    }
    expect(calls.reduce((n, cb) => n + cb.mock.calls.length, 0)).toBe(1);

    running = true;
    const again = vi.fn();
    rerender(ui(again));
    running = false;
    rerender(ui(again));
    rerender(ui(again));
    expect(again).toHaveBeenCalledTimes(1);
  });
});
