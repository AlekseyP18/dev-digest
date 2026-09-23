import { describe, it, expect, afterEach, vi } from "vitest";
import { screen, cleanup } from "@testing-library/react";
import { renderWithIntl } from "@/test/intl";

vi.mock("@/components/app-shell", () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock("./_components/SettingsApiKeys", () => ({ SettingsApiKeys: () => <div>api-keys-panel</div> }));
vi.mock("./_components/SettingsModels", () => ({ SettingsModels: () => <div>models-panel</div> }));

import { SettingsView } from "./SettingsView";

afterEach(cleanup);

describe("SettingsView", () => {
  it("renders the section from the route and marks it current in the nav", () => {
    renderWithIntl(<SettingsView section="models" />);
    expect(screen.getByText("models-panel")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Feature Models" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "API Keys" })).toHaveAttribute("href", "/settings/api-keys");
  });

  it("defaults to API keys", () => {
    renderWithIntl(<SettingsView />);
    expect(screen.getByText("api-keys-panel")).toBeInTheDocument();
  });
});
