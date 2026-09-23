import { describe, it, expect, afterEach } from "vitest";
import { screen, cleanup } from "@testing-library/react";
import { renderWithIntl } from "@/test/intl";
import { commentApi, reviewComment, thread } from "@/test/diff-fixtures";
import { CommentThreadView } from "./CommentThreadView";

afterEach(cleanup);

describe("CommentThreadView", () => {
  const th = thread([reviewComment({ id: 1 }), reviewComment({ id: 2, in_reply_to_id: 1, body: "Agreed" })]);

  it("renders the root and replies with a Reply action", () => {
    renderWithIntl(<CommentThreadView thread={th} commenting={commentApi()} path="src/config.ts" />);
    expect(screen.getByText("Use the env var")).toBeInTheDocument();
    expect(screen.getByText("Agreed")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reply" })).toBeInTheDocument();
  });

  it("hides Reply when commenting is not allowed (closed PR)", () => {
    renderWithIntl(<CommentThreadView thread={th} commenting={commentApi({ canComment: false })} path="src/config.ts" />);
    expect(screen.queryByRole("button", { name: "Reply" })).not.toBeInTheDocument();
  });
});
