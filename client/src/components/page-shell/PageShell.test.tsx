import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

vi.mock("@/components/app-shell", () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => <div data-testid="shell">{children}</div>,
}));

import { PageContainer, PageFallback } from "./PageShell";

afterEach(cleanup);

describe("PageShell", () => {
  it("PageContainer renders title, subtitle and actions", () => {
    render(
      <PageContainer title="Title" subtitle="Sub" actions={<button type="button">Act</button>}>
        body
      </PageContainer>,
    );
    expect(screen.getByRole("heading", { name: "Title" })).toBeInTheDocument();
    expect(screen.getByText("Sub")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Act" })).toBeInTheDocument();
  });

  it("PageFallback keeps the app shell visible while a page loads", () => {
    render(<PageFallback />);
    expect(screen.getByTestId("shell")).toBeInTheDocument();
  });
});
