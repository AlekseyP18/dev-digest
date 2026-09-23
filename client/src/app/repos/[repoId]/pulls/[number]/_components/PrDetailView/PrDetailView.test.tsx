import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { screen, cleanup, fireEvent } from "@testing-library/react";
import type { PrDetail } from "@devdigest/shared";
import { renderWithIntl } from "@/test/intl";

const replace = vi.fn();
let search = new URLSearchParams();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, push: vi.fn() }),
  usePathname: () => "/repos/repo-1/pulls/482",
  useSearchParams: () => search,
}));

const PR: PrDetail = {
  id: "pr-1",
  number: 482,
  title: "Add rate limiting to public API endpoints",
  author: "dev",
  branch: "feat/x",
  base: "main",
  head_sha: "abc",
  additions: 10,
  deletions: 2,
  files_count: 1,
  status: "open",
  opened_at: null,
  updated_at: null,
  score: null,
  cost_usd: null,
  severity_counts: null,
  body: "PR description text",
  files: [],
  commits: [],
};

let pull: { prId: string | null; pr?: PrDetail; isLoading: boolean; isError: boolean };
vi.mock("@/lib/hooks/core", () => ({
  usePullByNumber: () => ({ ...pull, error: null, refetch: vi.fn() }),
}));
vi.mock("@/lib/hooks/reviews", () => ({ usePrReviews: () => ({ data: [] }) }));
vi.mock("@/lib/repo-context", () => ({
  useActiveRepo: () => ({ activeRepo: { full_name: "acme/api" } }),
  useRepoNotFound: () => false,
}));
vi.mock("@/components/app-shell", () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
// Tab bodies are covered by their own tests; stub them to observe routing.
vi.mock("../FindingsTab", () => ({ FindingsTab: () => <div>findings-tab</div> }));
vi.mock("../DiffTab", () => ({ DiffTab: () => <div>diff-tab</div> }));
vi.mock("../PrDetailHeader", () => ({
  PrDetailHeader: ({ onSetTab }: { onSetTab: (t: string) => void }) => (
    <button type="button" onClick={() => onSetTab("diff")}>
      go-diff
    </button>
  ),
}));
vi.mock("../RunTraceDrawer", () => ({ RunTraceDrawer: ({ runId }: { runId: string }) => <div>trace {runId}</div> }));

import { PrDetailView } from "./PrDetailView";

beforeEach(() => {
  search = new URLSearchParams();
  replace.mockReset();
  pull = { prId: "pr-1", pr: PR, isLoading: false, isError: false };
});
afterEach(cleanup);

describe("PrDetailView", () => {
  it("shows the overview by default and treats an unknown ?tab as overview", () => {
    search = new URLSearchParams("tab=bogus");
    renderWithIntl(<PrDetailView repoId="repo-1" number={482} />);
    expect(screen.getByText("PR description text")).toBeInTheDocument();
  });

  it("renders the tab from ?tab and writes tab changes to the URL", () => {
    search = new URLSearchParams("tab=findings");
    renderWithIntl(<PrDetailView repoId="repo-1" number={482} />);
    expect(screen.getByText("findings-tab")).toBeInTheDocument();
    fireEvent.click(screen.getByText("go-diff"));
    // Switching tabs scrolls to the top like a page change.
    expect(replace).toHaveBeenCalledWith("/repos/repo-1/pulls/482?tab=diff", { scroll: true });
  });

  it("opens the run trace drawer from ?trace", () => {
    search = new URLSearchParams("trace=run-7");
    renderWithIntl(<PrDetailView repoId="repo-1" number={482} />);
    expect(screen.getByText("trace run-7")).toBeInTheDocument();
  });

  it("an unknown PR number shows a translated error with retry", () => {
    pull = { prId: null, pr: undefined, isLoading: false, isError: false };
    renderWithIntl(<PrDetailView repoId="repo-1" number={999} />);
    expect(screen.getByText("Couldn’t load this pull request")).toBeInTheDocument();
    expect(screen.getByText("PR #999 could not be loaded.")).toBeInTheDocument();
  });
});
