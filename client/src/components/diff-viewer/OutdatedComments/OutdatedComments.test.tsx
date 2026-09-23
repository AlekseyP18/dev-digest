import { describe, it, expect, afterEach } from "vitest";
import { screen, cleanup } from "@testing-library/react";
import { renderWithIntl } from "@/test/intl";
import { reviewComment, thread } from "@/test/diff-fixtures";
import { OutdatedComments } from "./OutdatedComments";

afterEach(cleanup);

describe("OutdatedComments", () => {
  it("renders nothing without outdated threads", () => {
    const { container } = renderWithIntl(<OutdatedComments threads={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it("counts every comment across threads", () => {
    renderWithIntl(
      <OutdatedComments
        threads={[thread([reviewComment({ id: 1, line: null }), reviewComment({ id: 2, in_reply_to_id: 1, body: "reply" })])]}
      />,
    );
    expect(screen.getByText("2 comment(s) on older revisions")).toBeInTheDocument();
    expect(screen.getByText("reply")).toBeInTheDocument();
  });
});
