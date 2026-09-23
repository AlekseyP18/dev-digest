import { describe, it, expect, afterEach, vi } from "vitest";
import { screen, cleanup, fireEvent, act } from "@testing-library/react";
import { renderWithIntl } from "@/test/intl";

const mutateAsync = vi.fn();
vi.mock("@/lib/hooks/core", () => ({
  useSecretsStatus: () => ({ data: { openai: true, anthropic: false, openrouter: false, github: true } }),
  useTestConnection: () => ({ mutateAsync, isPending: false }),
}));

import { SettingsApiKeys } from "./SettingsApiKeys";

afterEach(() => {
  cleanup();
  mutateAsync.mockReset();
});

describe("SettingsApiKeys", () => {
  it("shows each provider's configured status", () => {
    renderWithIntl(<SettingsApiKeys />);
    expect(screen.getAllByText("Configured")).toHaveLength(2);
    expect(screen.getAllByText("Not set")).toHaveLength(2);
  });

  it("the eye button reveals the typed key", () => {
    renderWithIntl(<SettingsApiKeys />);
    const input = screen.getAllByPlaceholderText(/stored via SecretsProvider/)[0]!;
    expect(input).toHaveAttribute("type", "password");
    fireEvent.click(screen.getAllByRole("button", { name: "Show key" })[0]!);
    expect(input).toHaveAttribute("type", "text");
  });

  it("tests a connection with the typed key and shows the result inline", async () => {
    mutateAsync.mockResolvedValue({ ok: true, message: "Connected" });
    renderWithIntl(<SettingsApiKeys />);
    fireEvent.change(screen.getAllByPlaceholderText(/stored via SecretsProvider/)[0]!, { target: { value: " sk-1 " } });
    await act(async () => fireEvent.click(screen.getAllByRole("button", { name: "Test connection" })[0]!));
    expect(mutateAsync).toHaveBeenCalledWith({ provider: "openai", key: "sk-1" });
    expect(screen.getByText("Connected")).toBeInTheDocument();
  });
});
