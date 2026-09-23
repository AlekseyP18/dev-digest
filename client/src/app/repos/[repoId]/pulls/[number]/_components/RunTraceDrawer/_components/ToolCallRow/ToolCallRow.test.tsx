import { describe, it, expect, afterEach } from "vitest";
import { screen, cleanup, fireEvent } from "@testing-library/react";
import { renderWithIntl } from "@/test/intl";
import { ToolCallRow } from "./ToolCallRow";

afterEach(cleanup);

describe("ToolCallRow", () => {
  it("shows the call summary and expands to args + result", () => {
    renderWithIntl(<ToolCallRow tc={{ tool: "review_file", args: "src/a.ts", meta: "3 findings", ms: 120 }} />);
    const row = screen.getByRole("button", { name: /review_file/ });
    expect(row).toHaveTextContent("120ms");
    expect(screen.queryByText(/args:/)).not.toBeInTheDocument();
    fireEvent.click(row);
    expect(screen.getByText(/args: src\/a\.ts/)).toBeInTheDocument();
    expect(screen.getByText(/result: 3 findings/)).toBeInTheDocument();
  });
});
