import { describe, it, expect, afterEach, vi } from "vitest";
import { renderHook, act, cleanup } from "@testing-library/react";
import { IntlProvider } from "@/test/intl";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }), usePathname: () => "/repos/r1/pulls" }));
vi.mock("@/lib/theme", () => ({ useTheme: () => ({ theme: "dark", toggle: vi.fn() }) }));
vi.mock("@/lib/repo-context", () => ({
  useActiveRepo: () => ({
    repoId: "r1",
    repos: [
      { id: "r1", full_name: "acme/api", default_branch: "main", last_polled_at: "2026-01-01" },
      { id: "r2", full_name: "acme/web", default_branch: "main", last_polled_at: null },
    ],
    activeRepo: { id: "r1", full_name: "acme/api", default_branch: "main", last_polled_at: "2026-01-01" },
    setRepoId: vi.fn(),
  }),
}));
type Cb = { onSuccess?: () => void };
const deleteRepo = vi.fn<(id: string, cb: Cb) => void>();
vi.mock("@/lib/hooks/core", () => ({
  usePulls: () => ({ data: [{ status: "needs_review" }, { status: "reviewed" }, { status: "needs_review" }] }),
  useDeleteRepo: () => ({ mutate: deleteRepo }),
}));
const confirm = vi.fn();
vi.mock("@/lib/confirm", () => ({ useConfirm: () => confirm }));

import { useShellContext } from "./useShellContext";

afterEach(() => {
  cleanup();
  push.mockReset();
  deleteRepo.mockReset();
  confirm.mockReset();
});

const setup = () => renderHook(() => useShellContext({ onOpenCommandPalette: vi.fn() }), { wrapper: IntlProvider });

describe("useShellContext", () => {
  it("maps repos with translated sync labels and counts PRs needing review", () => {
    const { result } = setup();
    expect(result.current.repos?.map((r) => r.syncedLabel)).toEqual(["synced", "not synced"]);
    expect(result.current.prCount).toBe(2);
    expect(result.current.activeKey).toBe("pulls");
  });

  it("removing the active repo asks first, then moves to the next repo", async () => {
    confirm.mockResolvedValue(true);
    deleteRepo.mockImplementation((_id, cb) => cb.onSuccess?.());
    const { result } = setup();
    await act(async () => result.current.onRemoveRepo?.("r1"));
    expect(confirm).toHaveBeenCalledWith(expect.objectContaining({ title: "Remove acme/api from DevDigest?", danger: true }));
    expect(push).toHaveBeenCalledWith("/repos/r2/pulls");
  });

  it("does nothing when the removal is cancelled", async () => {
    confirm.mockResolvedValue(false);
    const { result } = setup();
    await act(async () => result.current.onRemoveRepo?.("r1"));
    expect(deleteRepo).not.toHaveBeenCalled();
  });
});
