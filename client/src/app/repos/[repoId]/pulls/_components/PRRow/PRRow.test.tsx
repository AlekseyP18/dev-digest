import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { PrMeta } from "@/lib/types";
import prReview from "../../../../../../../messages/en/prReview.json";
import common from "../../../../../../../messages/en/common.json";
import { PRRow } from "./PRRow";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

afterEach(cleanup);

function pr(o: Partial<PrMeta>): PrMeta {
  return {
    id: "pr-1",
    number: 482,
    title: "Add rate limiting to public API endpoints",
    author: "marisa.koch",
    branch: "feat/rate-limit-public",
    base: "main",
    head_sha: "a1b2c3",
    additions: 247,
    deletions: 38,
    files_count: 9,
    status: "needs_review",
    opened_at: null,
    updated_at: null,
    score: 61,
    cost_usd: null,
    ...o,
  };
}

function renderRow(p: PrMeta) {
  return render(
    <NextIntlClientProvider locale="en" messages={{ prReview, common }}>
      <PRRow pr={p} repoId="repo-1" />
    </NextIntlClientProvider>,
  );
}

describe("PRRow — cost column", () => {
  it("shows the PR's total run cost", () => {
    renderRow(pr({ cost_usd: 0.014 }));
    expect(screen.getByText("$0.014")).toBeInTheDocument();
  });

  it("shows a dash when the PR has no known cost", () => {
    renderRow(pr({ cost_usd: null, score: 61 }));
    expect(screen.getByLabelText("Cost unknown")).toHaveTextContent("—");
  });
});
