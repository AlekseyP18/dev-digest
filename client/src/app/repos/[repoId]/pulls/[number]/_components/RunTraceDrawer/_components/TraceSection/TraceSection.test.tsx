import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { TraceSection } from "./TraceSection";

afterEach(cleanup);

describe("TraceSection", () => {
  it("toggles its body from a keyboard-accessible header", () => {
    render(
      <TraceSection icon="Code" title="Raw output" defaultOpen={false}>
        <p>body</p>
      </TraceSection>,
    );
    const header = screen.getByRole("button", { name: /Raw output/ });
    expect(header).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("body")).not.toBeInTheDocument();
    fireEvent.click(header);
    expect(screen.getByText("body")).toBeInTheDocument();
  });
});
