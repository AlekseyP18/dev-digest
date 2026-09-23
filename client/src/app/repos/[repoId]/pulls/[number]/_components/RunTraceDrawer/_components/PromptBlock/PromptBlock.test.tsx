import { describe, it, expect, afterEach, vi } from "vitest";
import { screen, cleanup, fireEvent } from "@testing-library/react";
import { renderWithIntl } from "@/test/intl";
import { PromptBlock } from "./PromptBlock";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("PromptBlock", () => {
  it("expands from the label button; copy doesn't toggle the block", () => {
    const writeText = vi.fn(async () => {});
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    renderWithIntl(<PromptBlock label="System" text="You are a reviewer." color="red" />);
    const toggle = screen.getByRole("button", { name: /System/ });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(screen.getByRole("button", { name: "Copy" }));
    expect(writeText).toHaveBeenCalledWith("You are a reviewer.");
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(toggle);
    expect(screen.getByText("You are a reviewer.")).toBeInTheDocument();
  });

  it("opens the fullscreen modal", () => {
    renderWithIntl(<PromptBlock label="User" text="Review PR #1" color="blue" />);
    fireEvent.click(screen.getByRole("button", { name: "Open fullscreen" }));
    expect(screen.getByRole("dialog")).toHaveTextContent("User");
  });
});
