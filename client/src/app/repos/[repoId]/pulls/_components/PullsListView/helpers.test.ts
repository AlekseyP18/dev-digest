import { describe, it, expect } from "vitest";
import type { PrMeta } from "@devdigest/shared";
import { filterPulls, pullCounts, sizeOf, sortPulls, toSortKey } from "./helpers";

const pr = (o: Partial<PrMeta>): PrMeta => ({
  id: "id",
  number: 1,
  title: "Title",
  author: "a",
  branch: "b",
  base: "main",
  head_sha: "sha",
  additions: 0,
  deletions: 0,
  files_count: 1,
  status: "needs_review",
  opened_at: null,
  updated_at: null,
  score: null,
  cost_usd: null,
  severity_counts: null,
  ...o,
});

describe("PR list helpers", () => {
  const pulls = [
    pr({ number: 10, title: "Add rate limiting", status: "needs_review", updated_at: "2026-01-02T00:00:00Z" }),
    pr({ number: 11, title: "Fix login", status: "reviewed", updated_at: "2026-01-03T00:00:00Z" }),
    pr({ number: 12, title: "Old merged", status: "merged", updated_at: null }),
  ];

  it("filters by status chip ('all' keeps everything) and by title or number", () => {
    expect(filterPulls(pulls, { status: "all", query: "" })).toHaveLength(3);
    expect(filterPulls(pulls, { status: "reviewed", query: "" }).map((p) => p.number)).toEqual([11]);
    expect(filterPulls(pulls, { status: "all", query: "  RATE " }).map((p) => p.number)).toEqual([10]);
    expect(filterPulls(pulls, { status: "all", query: "12" }).map((p) => p.number)).toEqual([12]);
  });

  it("sorts newest/oldest by updated_at with undated PRs as oldest, without mutating", () => {
    expect(sortPulls(pulls, "newest").map((p) => p.number)).toEqual([11, 10, 12]);
    expect(sortPulls(pulls, "oldest").map((p) => p.number)).toEqual([12, 10, 11]);
    expect(pulls.map((p) => p.number)).toEqual([10, 11, 12]);
  });

  it("counts open and needs-review PRs", () => {
    expect(pullCounts(pulls)).toEqual({ open: 2, needsReview: 1 });
  });

  it("normalizes the sort param and buckets size by changed lines", () => {
    expect(toSortKey("oldest")).toBe("oldest");
    expect(toSortKey("bogus")).toBe("newest");
    expect(toSortKey(null)).toBe("newest");
    expect(sizeOf(pr({ additions: 50, deletions: 10 })).size).toBe("S");
    expect(sizeOf(pr({ additions: 300, deletions: 10 })).size).toBe("M");
    expect(sizeOf(pr({ additions: 400, deletions: 0 })).size).toBe("L");
  });
});
