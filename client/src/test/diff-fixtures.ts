/* Shared fixtures for diff-viewer tests. */
import { vi } from "vitest";
import type { PrFile, PrReviewComment } from "@devdigest/shared";
import type { CommentThread, DiffCommentApi } from "@/components/diff-viewer/comments";

export const prFile = (o: Partial<PrFile> = {}): PrFile => ({
  path: "src/config.ts",
  additions: 1,
  deletions: 1,
  patch: "@@ -1,2 +1,2 @@\n-const key = 'old';\n+const key = process.env.KEY;\n unchanged",
  ...o,
});

export const reviewComment = (o: Partial<PrReviewComment> = {}): PrReviewComment => ({
  id: 1,
  path: "src/config.ts",
  line: 1,
  original_line: 1,
  side: "RIGHT",
  body: "Use the env var",
  user: "reviewer",
  created_at: "2026-01-01T00:00:00Z",
  html_url: "https://github.com/acme/api/pull/1#discussion_r1",
  in_reply_to_id: null,
  is_outdated: false,
  ...o,
});

export const thread = (comments: PrReviewComment[], o: Partial<CommentThread> = {}): CommentThread => ({
  rootId: comments[0]!.id,
  comments,
  line: comments[0]!.line,
  side: comments[0]!.side,
  isOutdated: comments[0]!.line == null,
  ...o,
});

export const commentApi = (o: Partial<DiffCommentApi> = {}): DiffCommentApi => ({
  comments: [],
  canComment: true,
  showComments: true,
  posting: false,
  onSubmit: vi.fn(async () => ({})),
  ...o,
});
