import { describe, it, expect, afterEach, vi } from "vitest";
import { screen, cleanup, fireEvent } from "@testing-library/react";
import { renderWithIntl } from "@/test/intl";
import { prFile, reviewComment } from "@/test/diff-fixtures";

vi.mock("@/lib/hooks/reviews", () => ({
  usePrComments: () => ({ data: [reviewComment({ body: "Nit: rename" })] }),
  useCreatePrComment: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

import { DiffTab } from "./DiffTab";

afterEach(cleanup);

describe("DiffTab", () => {
  it("titles the diff and keeps comments hidden until toggled", () => {
    renderWithIntl(<DiffTab prId="pr-1" filesCount={1} files={[prFile()]} canComment />);
    expect(screen.getByText("Files changed · 1 files")).toBeInTheDocument();
    expect(screen.queryByText("Nit: rename")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Show comments (1)" }));
    expect(screen.getByText("Nit: rename")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Hide comments (1)" })).toBeInTheDocument();
  });
});
