import { describe, it, expect, afterEach, vi } from "vitest";
import { screen, cleanup } from "@testing-library/react";
import type { Agent } from "@devdigest/shared";
import { renderWithIntl } from "@/test/intl";
import { ToastProvider } from "@/lib/toast";

let models: { id: string }[] | undefined = [];
vi.mock("@/lib/hooks/agents", () => ({
  useUpdateAgent: () => ({ mutate: vi.fn(), isPending: false, isSuccess: false }),
  useProviderModels: () => ({ data: models }),
}));

import { ConfigTab } from "./ConfigTab";
import { toForm, toPatch } from "./helpers";

afterEach(cleanup);

const AGENT: Agent = {
  id: "a1",
  name: "Security Reviewer",
  description: "d",
  provider: "anthropic",
  model: "claude-x",
  system_prompt: "p",
  output_schema: null,
  strategy: "auto",
  ci_fail_on: "warning",
  repo_intel: false,
  enabled: true,
  version: 3,
};

describe("ConfigTab", () => {
  it("guides the user to the API key when the provider returns no models", () => {
    models = [];
    renderWithIntl(
      <ToastProvider>
        <ConfigTab agent={AGENT} />
      </ToastProvider>,
    );
    expect(screen.getByText("No models loaded — set the anthropic API key in Settings → API Keys.")).toBeInTheDocument();
  });

  it("form ↔ patch round-trips every editable field", () => {
    expect(toPatch(toForm(AGENT))).toEqual({
      name: "Security Reviewer",
      description: "d",
      provider: "anthropic",
      model: "claude-x",
      system_prompt: "p",
      strategy: "auto",
      ci_fail_on: "warning",
      repo_intel: false,
      enabled: true,
    });
  });
});
