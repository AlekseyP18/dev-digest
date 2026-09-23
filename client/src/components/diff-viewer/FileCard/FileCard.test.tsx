import { describe, it, expect, afterEach } from "vitest";
import { screen, cleanup, fireEvent } from "@testing-library/react";
import { renderWithIntl } from "@/test/intl";
import { commentApi, prFile, reviewComment } from "@/test/diff-fixtures";
import { FileCard } from "./FileCard";

afterEach(cleanup);

describe("FileCard", () => {
  it("auto-expands small files and collapses large ones", () => {
    renderWithIntl(<FileCard file={prFile()} />);
    expect(screen.getByRole("button", { name: /src\/config\.ts/ })).toHaveAttribute("aria-expanded", "true");
    cleanup();
    renderWithIntl(<FileCard file={prFile({ additions: 5000, deletions: 0 })} />);
    const header = screen.getByRole("button", { name: /src\/config\.ts/ });
    expect(header).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(header);
    expect(header).toHaveAttribute("aria-expanded", "true");
  });

  it("shows this file's comment count in the header", () => {
    const commenting = commentApi({ comments: [reviewComment({ id: 1 }), reviewComment({ id: 2, path: "other.ts" })] });
    renderWithIntl(<FileCard file={prFile()} commenting={commenting} />);
    expect(screen.getByRole("button", { name: /src\/config\.ts/ })).toHaveTextContent(/1$/);
  });
});
