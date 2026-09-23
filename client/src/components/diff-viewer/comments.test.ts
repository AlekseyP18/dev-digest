import { describe, it, expect } from "vitest";
import type { PrReviewComment } from "@devdigest/shared";
import { buildThreads, commentTargetFor, keysForLine, lineKey, partitionThreads } from "./comments";
import { parsePatch } from "./helpers";

const comment = (o: Partial<PrReviewComment>): PrReviewComment => ({
  id: 1,
  path: "src/a.ts",
  line: 10,
  original_line: 10,
  side: "RIGHT",
  body: "b",
  user: "u",
  created_at: "2026-01-01T00:00:00Z",
  html_url: "https://github.com/x",
  in_reply_to_id: null,
  is_outdated: false,
  ...o,
});

describe("diff comments", () => {
  it("groups replies under their root, oldest first, anchored on the root's line", () => {
    const threads = buildThreads([
      comment({ id: 3, in_reply_to_id: 1, created_at: "2026-01-03T00:00:00Z", line: null }),
      comment({ id: 1, created_at: "2026-01-01T00:00:00Z", line: 10 }),
      comment({ id: 2, in_reply_to_id: 1, created_at: "2026-01-02T00:00:00Z" }),
      comment({ id: 9, line: null, side: "LEFT" }),
    ]);
    const main = threads.find((th) => th.rootId === 1)!;
    expect(main.comments.map((c) => c.id)).toEqual([1, 2, 3]);
    expect(main).toMatchObject({ line: 10, side: "RIGHT", isOutdated: false });
    expect(threads.find((th) => th.rootId === 9)).toMatchObject({ isOutdated: true });
  });

  it("maps rendered diff lines to thread keys and comment targets", () => {
    const [hunk, del, add, ctx] = parsePatch("@@ -5,2 +7,2 @@\n-old\n+new\n same");
    expect(keysForLine(hunk!)).toEqual([]);
    expect(keysForLine(del!)).toEqual(["LEFT:5"]);
    expect(keysForLine(add!)).toEqual(["RIGHT:7"]);
    expect(keysForLine(ctx!)).toEqual(["RIGHT:8", "LEFT:6"]);
    expect(commentTargetFor(del!)).toEqual({ line: 5, side: "LEFT" });
    expect(commentTargetFor(ctx!)).toEqual({ line: 8, side: "RIGHT" });
    expect(commentTargetFor(hunk!)).toBeNull();
    expect(lineKey("RIGHT", null)).toBeNull();
  });

  it("threads whose line isn't rendered are kept as outdated, never dropped", () => {
    const threads = buildThreads([comment({ id: 1, line: 7 }), comment({ id: 2, line: 99 }), comment({ id: 3, line: null })]);
    const { matched, outdated } = partitionThreads(threads, new Set(["RIGHT:7"]));
    expect(matched.get("RIGHT:7")?.map((th) => th.rootId)).toEqual([1]);
    expect(outdated.map((th) => th.rootId).sort()).toEqual([2, 3]);
  });
});
