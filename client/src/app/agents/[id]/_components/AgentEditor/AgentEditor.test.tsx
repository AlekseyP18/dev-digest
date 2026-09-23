import { describe, it, expect, afterEach, vi } from "vitest";
import { screen, cleanup, fireEvent } from "@testing-library/react";
import type { Agent } from "@devdigest/shared";
import { ToastProvider } from "@/lib/toast";
import { renderWithIntl } from "@/test/intl";

const mutate = vi.fn();
// Mock the data hooks so the editor renders without a network/query client.
vi.mock("@/lib/hooks/agents", () => ({
  useUpdateAgent: () => ({ mutate, isPending: false, isSuccess: false, data: undefined }),
  useProviderModels: () => ({ data: [{ id: "gpt-4.1", provider: "openai" }] }),
}));

import { AgentEditor } from "./AgentEditor";

afterEach(() => {
  cleanup();
  mutate.mockReset();
});

const AGENT: Agent = {
  id: "ag1",
  name: "Security Reviewer",
  description: "Flags secrets and injection",
  provider: "openai",
  model: "gpt-4.1",
  system_prompt: "You are a security reviewer.",
  output_schema: null,
  strategy: "single-pass",
  ci_fail_on: "critical",
  repo_intel: true,
  enabled: true,
  version: 1,
};

const OTHER: Agent = { ...AGENT, id: "ag2", name: "Perf Reviewer", system_prompt: "You review performance." };

function editor(agent: Agent) {
  return (
    <ToastProvider>
      <AgentEditor agent={agent} tab="config" onTab={() => {}} />
    </ToastProvider>
  );
}

describe("Agent Editor — Config tab", () => {
  it("renders the Config tab fields", () => {
    renderWithIntl(editor(AGENT));
    expect(screen.getByText("Config")).toBeInTheDocument();
    expect(screen.getByText("Configuration")).toBeInTheDocument();
    expect(screen.getByText("Save agent")).toBeInTheDocument();
    expect(screen.getByText("Standard findings JSON")).toBeInTheDocument();
  });

  it("saves every edited field in one PUT", () => {
    renderWithIntl(editor(AGENT));
    fireEvent.change(screen.getByDisplayValue("Security Reviewer"), { target: { value: "Sec v2" } });
    fireEvent.click(screen.getByText("Save agent"));
    expect(mutate).toHaveBeenCalledWith(
      {
        id: "ag1",
        patch: {
          name: "Sec v2",
          description: AGENT.description,
          provider: "openai",
          model: "gpt-4.1",
          system_prompt: AGENT.system_prompt,
          strategy: "single-pass",
          ci_fail_on: "critical",
          repo_intel: true,
          enabled: true,
        },
      },
      expect.anything(),
    );
  });

  it("switching agents discards unsaved edits and shows the new agent's values", () => {
    const { rerender } = renderWithIntl(editor(AGENT));
    fireEvent.change(screen.getByDisplayValue("Security Reviewer"), { target: { value: "unsaved" } });
    rerender(editor(OTHER));
    expect(screen.getByDisplayValue("Perf Reviewer")).toBeInTheDocument();
    expect(screen.getByDisplayValue("You review performance.")).toBeInTheDocument();
    expect(screen.queryByDisplayValue("unsaved")).not.toBeInTheDocument();
  });
});
