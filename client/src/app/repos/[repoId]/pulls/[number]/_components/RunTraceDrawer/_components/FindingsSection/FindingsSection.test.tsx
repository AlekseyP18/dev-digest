import { describe, it, expect, afterEach } from "vitest";
import { screen, cleanup } from "@testing-library/react";
import { renderWithIntl } from "@/test/intl";
import { finding } from "@/components/finding-severity/fixtures.test-utils";
import { FindingsSection } from "./FindingsSection";

afterEach(cleanup);

describe("FindingsSection", () => {
  it("lists the run's findings with location and suggested fix", () => {
    renderWithIntl(
      <FindingsSection
        findings={[finding({ id: "a", title: "Hardcoded secret", file: "src/config.ts", start_line: 11, end_line: 13, suggestion: "Use env" })]}
      />,
    );
    expect(screen.getByText("Hardcoded secret")).toBeInTheDocument();
    expect(screen.getByText("src/config.ts:11-13")).toBeInTheDocument();
    expect(screen.getByText("Use env")).toBeInTheDocument();
  });

  it("shows the empty message", () => {
    renderWithIntl(<FindingsSection findings={[]} />);
    expect(screen.getByText("No findings for this run.")).toBeInTheDocument();
  });
});
