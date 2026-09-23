import { describe, it, expect, afterEach, vi } from "vitest";
import { screen, cleanup, fireEvent } from "@testing-library/react";
import type { Agent } from "@devdigest/shared";
import { renderWithIntl } from "@/test/intl";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace: vi.fn() }),
  usePathname: () => "/agents/a1",
  useSearchParams: () => new URLSearchParams("tab=bogus"),
}));
vi.mock("@/components/app-shell", () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock("../AgentEditor", () => ({ AgentEditor: ({ tab }: { tab: string }) => <div>editor tab={tab}</div> }));

const AGENT: Agent = {
  id: "a1",
  name: "Security Reviewer",
  description: "",
  provider: "openai",
  model: "gpt-4.1",
  system_prompt: "p",
  output_schema: null,
  strategy: "single-pass",
  ci_fail_on: "critical",
  repo_intel: true,
  enabled: false,
  version: 1,
};
let agentQuery: { data?: Agent; isLoading: boolean; isError: boolean } = { data: AGENT, isLoading: false, isError: false };
vi.mock("@/lib/hooks/agents", () => ({
  useAgents: () => ({ data: [AGENT, { ...AGENT, id: "a2", name: "Perf Reviewer" }] }),
  useAgent: () => ({ ...agentQuery, error: null, refetch: vi.fn() }),
  useUpdateAgent: () => ({ mutate: vi.fn() }),
  useDeleteAgent: () => ({ mutate: vi.fn(), isPending: false }),
}));

import { AgentEditorView } from "./AgentEditorView";

afterEach(cleanup);

describe("AgentEditorView", () => {
  it("shows the agent header, falls back to the first tab, and switches agents", () => {
    agentQuery = { data: AGENT, isLoading: false, isError: false };
    renderWithIntl(<AgentEditorView id="a1" />);
    expect(screen.getByText("openai/gpt-4.1")).toBeInTheDocument();
    expect(screen.getByText("disabled")).toBeInTheDocument();
    expect(screen.getByText("editor tab=config")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Perf Reviewer" }));
    expect(push).toHaveBeenCalledWith("/agents/a2?tab=config");
  });

  it("shows a translated error when the agent can't be loaded", () => {
    agentQuery = { data: undefined, isLoading: false, isError: true };
    renderWithIntl(<AgentEditorView id="missing" />);
    expect(screen.getByText("Couldn’t load this agent")).toBeInTheDocument();
  });
});
