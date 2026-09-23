import { describe, it, expect, afterEach, vi } from "vitest";
import { screen, cleanup } from "@testing-library/react";
import { renderWithIntl } from "@/test/intl";

vi.mock("@/lib/hooks/core", () => ({
  useSettings: () => ({ data: { feature_models: { risk_brief: { provider: "openrouter", model: "z-ai/glm" } } } }),
  useUpdateSettings: () => ({ mutate: vi.fn() }),
}));
vi.mock("@/lib/hooks/agents", () => ({ useProviderModels: () => ({ data: [] }) }));

import { SettingsModels } from "./SettingsModels";

afterEach(cleanup);

describe("SettingsModels", () => {
  it("lists every feature with translated labels and marks unset ones as default", () => {
    renderWithIntl(<SettingsModels />);
    expect(screen.getByText("Onboarding Tour")).toBeInTheDocument();
    expect(screen.getByText("Assesses merge risks for a pull request.")).toBeInTheDocument();
    // 5 features, one chosen → 4 on their default
    expect(screen.getAllByText("default")).toHaveLength(4);
  });
});
