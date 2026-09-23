/**
 * FindingsTab — keyboard shortcuts reach exactly ONE open run (regression for
 * "a" accepting the focused finding in every expanded accordion), and the key
 * that completes the shell's `g`-chord is not a finding action.
 */
import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { FindingRecord, ReviewRecord } from "@devdigest/shared";

const findingAction = vi.fn();
let reviews: ReviewRecord[] = [];

vi.mock("@/lib/hooks/reviews", () => ({
  usePrReviews: () => ({ data: reviews }),
  usePrRuns: () => ({ data: [] }),
  usePrActiveRuns: () => ({ data: [] }),
  useCancelRun: () => ({ mutate: vi.fn(), isPending: false }),
  useDeleteRun: () => ({ mutate: vi.fn(), isPending: false }),
  useDeleteReview: () => ({ mutate: vi.fn(), isPending: false }),
  useRunSettled: () => vi.fn(),
  useRunEvents: () => ({ events: [], running: false }),
  useFindingAction: () => ({ mutate: findingAction, isPending: false }),
}));

import { FindingsTab } from "./FindingsTab";
import { namespace } from "@/test/intl";

const prReview = namespace("prReview");
const common = namespace("common");

const finding = (id: string, reviewId: string): FindingRecord => ({
  id,
  severity: "WARNING",
  category: "bug",
  title: `Finding ${id}`,
  file: "src/a.ts",
  start_line: 1,
  end_line: 1,
  rationale: "Why.",
  suggestion: null,
  confidence: 0.9,
  kind: "finding",
  trifecta_components: null,
  evidence: null,
  review_id: reviewId,
  accepted_at: null,
  dismissed_at: null,
});

const review = (id: string, agent: string, created_at: string): ReviewRecord => ({
  id,
  pr_id: "pr-1",
  agent_id: agent,
  run_id: `run-${id}`,
  agent_name: agent,
  kind: "review",
  verdict: "comment",
  summary: null,
  score: 70,
  model: null,
  created_at,
  findings: [finding(`f-${id}`, id)],
});

function tab() {
  return (
    <NextIntlClientProvider locale="en" messages={{ prReview, common }}>
      <FindingsTab prId="pr-1" prCommits={[]} onOpenTrace={vi.fn()} />
    </NextIntlClientProvider>
  );
}

function renderTab() {
  return render(tab());
}

beforeEach(() => {
  findingAction.mockReset();
  reviews = [review("new", "Security", "2026-02-01T00:00:00Z"), review("old", "Perf", "2026-01-01T00:00:00Z")];
});
afterEach(cleanup);

describe("FindingsTab — findings shortcuts", () => {
  it("opens only the newest run by default", () => {
    renderTab();
    expect(screen.getByText("Finding f-new")).toBeInTheDocument();
    expect(screen.queryByText("Finding f-old")).not.toBeInTheDocument();
  });

  it("with two runs expanded, one key press acts on one finding (the last opened run)", () => {
    renderTab();
    fireEvent.click(screen.getByRole("button", { name: /Perf/ }));
    expect(screen.getByText("Finding f-old")).toBeInTheDocument();
    expect(screen.getByText("Finding f-new")).toBeInTheDocument();

    fireEvent.keyDown(window, { key: "a" });
    expect(findingAction).toHaveBeenCalledTimes(1);
    expect(findingAction).toHaveBeenCalledWith(
      expect.objectContaining({ findingId: "f-old", action: "accept", prId: "pr-1" }),
    );
  });

  it("closing the active run hands the shortcuts to the remaining open run", () => {
    renderTab();
    fireEvent.click(screen.getByRole("button", { name: /Perf/ })); // open
    fireEvent.click(screen.getByRole("button", { name: /Perf/ })); // close
    fireEvent.keyDown(window, { key: "d" });
    expect(findingAction).toHaveBeenCalledTimes(1);
    expect(findingAction).toHaveBeenCalledWith(expect.objectContaining({ findingId: "f-new", action: "dismiss" }));
  });

  it("the key after `g` belongs to shell navigation, not to the finding", () => {
    renderTab();
    fireEvent.keyDown(window, { key: "g" });
    fireEvent.keyDown(window, { key: "a" });
    expect(findingAction).not.toHaveBeenCalled();
    fireEvent.keyDown(window, { key: "a" });
    expect(findingAction).toHaveBeenCalledTimes(1);
  });

  it("a newer run arriving opens on top but doesn't collapse or steal keys from the one being read", () => {
    const { rerender } = renderTab();
    reviews = [review("newest", "Docs", "2026-03-01T00:00:00Z"), ...reviews];
    rerender(tab());
    expect(screen.getByText("Finding f-newest")).toBeInTheDocument();
    expect(screen.getByText("Finding f-new")).toBeInTheDocument();
    fireEvent.keyDown(window, { key: "a" });
    expect(findingAction).toHaveBeenCalledTimes(1);
    expect(findingAction).toHaveBeenCalledWith(expect.objectContaining({ findingId: "f-new" }));
  });

  it("deleting the newest run doesn't auto-open the next one", () => {
    const { rerender } = renderTab();
    reviews = reviews.slice(1);
    rerender(tab());
    expect(screen.queryByText("Finding f-old")).not.toBeInTheDocument();
  });

  it("modifier combos (⌘A select-all) never trigger a finding action", () => {
    renderTab();
    fireEvent.keyDown(window, { key: "a", metaKey: true });
    fireEvent.keyDown(window, { key: "a", ctrlKey: true });
    expect(findingAction).not.toHaveBeenCalled();
  });
});
