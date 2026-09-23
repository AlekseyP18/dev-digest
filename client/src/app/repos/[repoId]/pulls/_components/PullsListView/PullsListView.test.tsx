import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { screen, cleanup, fireEvent, act } from "@testing-library/react";
import type { PrMeta } from "@devdigest/shared";
import { renderWithIntl } from "@/test/intl";

const replace = vi.fn();
let search = new URLSearchParams();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, push: vi.fn() }),
  usePathname: () => "/repos/repo-1/pulls",
  useSearchParams: () => search,
}));

const pull = (number: number, title: string, status: PrMeta["status"]): PrMeta => ({
  id: `id-${number}`,
  number,
  title,
  author: "dev",
  branch: "b",
  base: "main",
  head_sha: "sha",
  additions: 1,
  deletions: 1,
  files_count: 1,
  status,
  opened_at: null,
  updated_at: null,
  score: null,
  cost_usd: null,
  severity_counts: null,
});

vi.mock("@/lib/hooks/core", () => ({
  usePulls: () => ({
    data: [pull(1, "Needs work", "needs_review"), pull(2, "Already reviewed", "reviewed")],
    isLoading: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
  }),
  useRefreshRepo: () => ({ mutate: vi.fn(), isPending: false }),
}));
vi.mock("@/lib/hooks/reviews", () => ({ usePrReviews: () => ({ data: undefined, isLoading: false }) }));
vi.mock("@/lib/repo-context", () => ({
  useActiveRepo: () => ({ activeRepo: { full_name: "acme/api" } }),
  useRepoNotFound: () => false,
}));
// The shell is covered elsewhere; render just its content here.
vi.mock("@/components/app-shell", () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

import { PullsListView } from "./PullsListView";

beforeEach(() => {
  search = new URLSearchParams();
  replace.mockReset();
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
  cleanup();
});

describe("PullsListView", () => {
  it("defaults to the needs-review filter", () => {
    renderWithIntl(<PullsListView repoId="repo-1" />);
    expect(screen.getByText("Needs work")).toBeInTheDocument();
    expect(screen.queryByText("Already reviewed")).not.toBeInTheDocument();
  });

  it("reads status from the URL and writes chip clicks back to it", () => {
    search = new URLSearchParams("status=all");
    renderWithIntl(<PullsListView repoId="repo-1" />);
    expect(screen.getByText("Already reviewed")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Reviewed", { selector: "button, button *" }));
    // Filters keep the scroll position.
    expect(replace).toHaveBeenCalledWith("/repos/repo-1/pulls?status=reviewed", { scroll: false });
  });

  it("a ?q cleared from outside (nav link) clears the box and is not written back", () => {
    search = new URLSearchParams("status=all&q=already");
    const { rerender } = renderWithIntl(<PullsListView repoId="repo-1" />);
    expect(screen.getByPlaceholderText("Filter pull requests…")).toHaveValue("already");
    search = new URLSearchParams("status=all");
    rerender(<PullsListView repoId="repo-1" />);
    expect(screen.getByPlaceholderText("Filter pull requests…")).toHaveValue("");
    act(() => vi.advanceTimersByTime(400));
    expect(replace).not.toHaveBeenCalled();
  });

  it("our own URL write landing late doesn't clobber what the user kept typing", () => {
    search = new URLSearchParams("status=all");
    const { rerender } = renderWithIntl(<PullsListView repoId="repo-1" />);
    const box = screen.getByPlaceholderText("Filter pull requests…");
    fireEvent.change(box, { target: { value: "alr" } });
    act(() => vi.advanceTimersByTime(400)); // writes ?q=alr (router applies it later)
    fireEvent.change(box, { target: { value: "alre" } });
    search = new URLSearchParams("status=all&q=alr");
    rerender(<PullsListView repoId="repo-1" />);
    expect(box).toHaveValue("alre");
  });

  it("filters instantly while typing and writes ?q= after a pause", () => {
    search = new URLSearchParams("status=all");
    renderWithIntl(<PullsListView repoId="repo-1" />);
    fireEvent.change(screen.getByPlaceholderText("Filter pull requests…"), { target: { value: "already" } });
    expect(screen.queryByText("Needs work")).not.toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(400));
    expect(replace).toHaveBeenCalledWith("/repos/repo-1/pulls?status=all&q=already", { scroll: false });
  });
});
