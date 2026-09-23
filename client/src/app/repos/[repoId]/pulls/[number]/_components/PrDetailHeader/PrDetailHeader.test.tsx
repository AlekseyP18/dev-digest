import { describe, it, expect, afterEach, vi } from "vitest";
import { screen, cleanup, fireEvent } from "@testing-library/react";
import type { PrDetail } from "@devdigest/shared";
import { renderWithIntl } from "@/test/intl";

vi.mock("../RunReviewDropdown", () => ({
  RunReviewDropdown: ({ warnMerged }: { warnMerged: boolean }) => <span>run-review warn={String(warnMerged)}</span>,
}));

import { PrDetailHeader } from "./PrDetailHeader";

afterEach(cleanup);

const pr = (status: PrDetail["status"]): PrDetail => ({
  id: "pr-1",
  number: 482,
  title: "Add rate limiting",
  author: "dev",
  branch: "feat/x",
  base: "main",
  head_sha: "abc",
  additions: 10,
  deletions: 2,
  files_count: 3,
  status,
  opened_at: null,
  updated_at: null,
  score: null,
  cost_usd: null,
  severity_counts: null,
  files: [],
  commits: [],
});

function renderHeader(status: PrDetail["status"], onSetTab = vi.fn()) {
  renderWithIntl(
    <PrDetailHeader pr={pr(status)} prId="pr-1" tab="overview" findingsCount={2} githubUrl={null} onSetTab={onSetTab} onRunStart={vi.fn()} />,
  );
  return onSetTab;
}

describe("PrDetailHeader", () => {
  it("shows translated tabs (the e2e flows click 'Agent runs' / 'Files changed')", () => {
    const onSetTab = renderHeader("open");
    fireEvent.click(screen.getByRole("button", { name: /Agent runs/ }));
    expect(onSetTab).toHaveBeenCalledWith("findings");
    expect(screen.getByRole("button", { name: /Files changed/ })).toBeInTheDocument();
    expect(screen.getByText("run-review warn=false")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /View on GitHub/ })).toBeDisabled();
  });

  it("a merged PR warns that a review is informational only", () => {
    renderHeader("merged");
    expect(screen.getByText(/already merged — running a review is informational/)).toBeInTheDocument();
    expect(screen.getByText("run-review warn=true")).toBeInTheDocument();
  });
});
