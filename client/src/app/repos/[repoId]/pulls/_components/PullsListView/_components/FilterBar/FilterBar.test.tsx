import { describe, it, expect, afterEach, vi } from "vitest";
import { screen, cleanup, fireEvent } from "@testing-library/react";
import { renderWithIntl } from "@/test/intl";
import { FilterBar } from "./FilterBar";

afterEach(cleanup);

function renderBar(over: Partial<React.ComponentProps<typeof FilterBar>> = {}) {
  const props = {
    active: "needs_review",
    onActive: vi.fn(),
    query: "",
    onQuery: vi.fn(),
    sort: "newest" as const,
    onSort: vi.fn(),
    onRefresh: vi.fn(),
    refreshing: false,
    ...over,
  };
  renderWithIntl(<FilterBar {...props} />);
  return props;
}

describe("FilterBar", () => {
  it("reports status chip, search and refresh interactions", () => {
    const p = renderBar();
    fireEvent.click(screen.getByText("All"));
    expect(p.onActive).toHaveBeenCalledWith("all");
    fireEvent.change(screen.getByPlaceholderText("Filter pull requests…"), { target: { value: "rate" } });
    expect(p.onQuery).toHaveBeenCalledWith("rate");
    fireEvent.click(screen.getByRole("button", { name: /Refresh/ }));
    expect(p.onRefresh).toHaveBeenCalled();
  });

  it("disables refresh while a sync is running", () => {
    renderBar({ refreshing: true });
    expect(screen.getByRole("button", { name: /Refreshing/ })).toBeDisabled();
  });
});
