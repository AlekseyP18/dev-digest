import { describe, it, expect, afterEach } from "vitest";
import { screen, cleanup } from "@testing-library/react";
import { renderWithIntl } from "@/test/intl";
import { OverviewTab } from "./OverviewTab";

afterEach(cleanup);

describe("OverviewTab", () => {
  it("shows the PR description under a translated heading", () => {
    renderWithIntl(<OverviewTab prBody="Adds rate limiting." />);
    expect(screen.getByText("Description")).toBeInTheDocument();
    expect(screen.getByText("Adds rate limiting.")).toBeInTheDocument();
  });

  it("renders nothing without a description", () => {
    const { container } = renderWithIntl(<OverviewTab prBody={null} />);
    expect(container).toBeEmptyDOMElement();
  });
});
