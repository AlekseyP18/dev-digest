import { describe, it, expect, afterEach, vi } from "vitest";
import { screen, cleanup, fireEvent } from "@testing-library/react";
import type { Agent } from "@devdigest/shared";
import { renderWithIntl } from "@/test/intl";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("@/components/app-shell", () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

const agent = (id: string, name: string, description = ""): Agent => ({
  id,
  name,
  description,
  provider: "openai",
  model: "gpt-4.1",
  system_prompt: "p",
  output_schema: null,
  strategy: "single-pass",
  ci_fail_on: "critical",
  repo_intel: true,
  enabled: true,
  version: 1,
});
let agents: Agent[] = [];
vi.mock("@/lib/hooks/agents", () => ({
  useAgents: () => ({ data: agents, isLoading: false, isError: false, refetch: vi.fn() }),
  useUpdateAgent: () => ({ mutate: vi.fn() }),
  useDeleteAgent: () => ({ mutate: vi.fn(), isPending: false }),
  useCreateAgent: () => ({ mutate: vi.fn(), isPending: false }),
}));

import { AgentsListView } from "./AgentsListView";

afterEach(cleanup);

describe("AgentsListView", () => {
  it("lists agents, filters by search and opens one", () => {
    agents = [agent("a1", "Security Reviewer"), agent("a2", "Perf Reviewer")];
    renderWithIntl(<AgentsListView />);
    fireEvent.change(screen.getByPlaceholderText("Search agents…"), { target: { value: "perf" } });
    expect(screen.queryByText("Security Reviewer")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Perf Reviewer" }));
    expect(push).toHaveBeenCalledWith("/agents/a2?tab=config");
  });

  it("shows the empty state with a create action", () => {
    agents = [];
    renderWithIntl(<AgentsListView />);
    expect(screen.getByText("No agents yet")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Create your first agent" }));
    expect(screen.getByRole("dialog")).toHaveTextContent("Create agent");
  });
});
