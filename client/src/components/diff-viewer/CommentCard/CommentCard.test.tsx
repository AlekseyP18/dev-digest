import { describe, it, expect, afterEach } from "vitest";
import { screen, cleanup } from "@testing-library/react";
import { renderWithIntl } from "@/test/intl";
import { reviewComment } from "@/test/diff-fixtures";
import { CommentCard } from "./CommentCard";

afterEach(cleanup);

describe("CommentCard", () => {
  it("shows author, markdown body and a GitHub link", () => {
    renderWithIntl(<CommentCard c={reviewComment({ body: "**Use** the env var" })} />);
    expect(screen.getByText("reviewer")).toBeInTheDocument();
    expect(screen.getByText("Use").tagName).toBe("STRONG");
    expect(screen.getByRole("link", { name: /View on GitHub/ })).toHaveAttribute(
      "href",
      "https://github.com/acme/api/pull/1#discussion_r1",
    );
  });
});
