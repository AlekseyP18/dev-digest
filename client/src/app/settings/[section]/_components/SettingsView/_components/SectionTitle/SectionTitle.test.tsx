import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { SectionTitle } from "./SectionTitle";

afterEach(cleanup);

describe("SectionTitle", () => {
  it("renders a heading and its lede", () => {
    render(<SectionTitle title="API Keys" body="Bring your own keys." />);
    expect(screen.getByRole("heading", { name: "API Keys" })).toBeInTheDocument();
    expect(screen.getByText("Bring your own keys.")).toBeInTheDocument();
  });
});
