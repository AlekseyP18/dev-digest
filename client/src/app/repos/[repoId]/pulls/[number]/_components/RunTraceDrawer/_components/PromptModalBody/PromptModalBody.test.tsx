import { describe, it, expect, afterEach } from "vitest";
import { screen, cleanup, fireEvent } from "@testing-library/react";
import { renderWithIntl } from "@/test/intl";
import { PromptModalBody } from "./PromptModalBody";

afterEach(cleanup);

describe("PromptModalBody", () => {
  it("filters lines by the search and highlights matches", () => {
    const { container } = renderWithIntl(<PromptModalBody text={"alpha line\nbeta line\nAlpha again"} />);
    fireEvent.change(screen.getByPlaceholderText("Search in this block…"), { target: { value: "alpha" } });
    expect(screen.getByText("2 / 3")).toBeInTheDocument();
    expect(container.querySelectorAll("mark")).toHaveLength(2);
    expect(screen.queryByText("beta line")).not.toBeInTheDocument();
  });

  it("says so when nothing matches", () => {
    renderWithIntl(<PromptModalBody text="alpha" />);
    fireEvent.change(screen.getByPlaceholderText("Search in this block…"), { target: { value: "zzz" } });
    expect(screen.getByText("No matches for “zzz”.")).toBeInTheDocument();
  });
});
