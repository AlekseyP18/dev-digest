import { describe, it, expect, afterEach } from "vitest";
import { screen, cleanup, fireEvent } from "@testing-library/react";
import { renderWithIntl } from "@/test/intl";
import { commentApi } from "@/test/diff-fixtures";
import { CodeLine } from "./CodeLine";

afterEach(cleanup);

describe("CodeLine", () => {
  it("renders a hunk header as plain text", () => {
    renderWithIntl(<CodeLine ln={{ kind: "hunk", text: "@@ -1 +1 @@" }} path="a.ts" threads={[]} />);
    expect(screen.getByText("@@ -1 +1 @@")).toBeInTheDocument();
  });

  it("offers '+' on hover only when commenting is allowed", () => {
    const { container } = renderWithIntl(
      <CodeLine ln={{ kind: "add", text: "x", newNo: 3 }} path="a.ts" threads={[]} commenting={commentApi()} />,
    );
    expect(screen.queryByRole("button", { name: "Add a comment on this line" })).not.toBeInTheDocument();
    fireEvent.mouseEnter(container.firstChild as Element);
    expect(screen.getByRole("button", { name: "Add a comment on this line" })).toBeInTheDocument();
    cleanup();
    const closed = renderWithIntl(
      <CodeLine ln={{ kind: "add", text: "x", newNo: 3 }} path="a.ts" threads={[]} commenting={commentApi({ canComment: false })} />,
    );
    fireEvent.mouseEnter(closed.container.firstChild as Element);
    expect(screen.queryByRole("button", { name: "Add a comment on this line" })).not.toBeInTheDocument();
  });
});
