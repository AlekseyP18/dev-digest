import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { screen, cleanup, fireEvent } from "@testing-library/react";
import { renderWithIntl } from "@/test/intl";

const replace = vi.fn();
const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace, push }) }));
vi.mock("@/components/app-shell", () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
let repos: { data?: { id: string; full_name: string }[]; isLoading: boolean; isError: boolean };
vi.mock("@/lib/hooks/core", () => ({ useRepos: () => repos }));

import { HomeView } from "./HomeView";

beforeEach(() => {
  replace.mockReset();
  push.mockReset();
});
afterEach(cleanup);

describe("HomeView", () => {
  it("redirects to the first repo's PR list", () => {
    repos = { data: [{ id: "r1", full_name: "acme/api" }], isLoading: false, isError: false };
    renderWithIntl(<HomeView />);
    expect(replace).toHaveBeenCalledWith("/repos/r1/pulls");
    expect(screen.getByRole("button", { name: "Open acme/api" })).toBeInTheDocument();
  });

  it("offers onboarding when there are no repos", () => {
    repos = { data: [], isLoading: false, isError: false };
    renderWithIntl(<HomeView />);
    expect(replace).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Add repository" }));
    expect(push).toHaveBeenCalledWith("/onboarding");
  });
});
