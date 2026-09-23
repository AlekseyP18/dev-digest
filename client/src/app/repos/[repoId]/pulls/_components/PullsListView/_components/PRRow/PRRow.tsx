/* PRRow — one row of the PR list table. The title is a real link stretched over
   the row (`.dd-stretched` / `.dd-row*` in app/globals.css): keyboard, middle-click and
   "open in new tab" work; the findings popover sits above the link. */
"use client";

import React from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Icon, Avatar, Badge, CircularScore } from "@devdigest/ui";
import type { PrMeta } from "@/lib/types";
import { RunCostBadge } from "@/components/run-cost-badge";
import { FindingsPopover, SeverityCounts, latestReviewsPerAgent } from "@/components/finding-severity";
import { totalFindings } from "@/lib/severity";
import { usePrReviews } from "@/lib/hooks/reviews";
import { SIZE_COLOR, STATUS_META } from "../../constants";
import { relativeTime, sizeOf } from "../../helpers";
import { s } from "../../styles";

export function PRRow({ pr, repoId }: { pr: PrMeta; repoId: string }) {
  const t = useTranslations("prReview");
  const st = STATUS_META[pr.status] ?? STATUS_META.needs_review!;
  const { size, lines } = sizeOf(pr);
  const reviewed = pr.score != null; // null score ⇒ PR has never been reviewed
  // Finding previews load lazily — only once the FINDINGS popover is opened.
  const [previewOpened, setPreviewOpened] = React.useState(false);
  const reviews = usePrReviews(previewOpened ? pr.id : null);
  const findingsTotal = totalFindings(pr.severity_counts);
  // Same scope as severity_counts: the latest review of each agent.
  const previewFindings = reviews.data
    ? latestReviewsPerAgent(reviews.data).flatMap((r) => r.findings)
    : undefined;
  return (
    <div className="dd-row" style={s.row}>
      <div style={s.rowTitleCell}>
        <Icon.GitPullRequest size={15} style={s.rowIcon(st.c)} />
        <div style={s.rowTitleWrap}>
          {/* No prefetch: a long list would prefetch every PR route on idle. */}
          <Link
            href={`/repos/${repoId}/pulls/${pr.number}`}
            prefetch={false}
            className="dd-row-link dd-stretched"
            style={s.rowTitle}
          >
            {pr.title}
          </Link>
          <span className="mono" style={s.rowNumber}>
            #{pr.number}
          </span>
        </div>
      </div>
      <div style={s.authorCell}>
        <Avatar name={pr.author} size={18} />
        {pr.author}
      </div>
      <div>
        <Badge
          color={SIZE_COLOR[size]}
          bg="transparent"
          style={s.sizeBadgeBorder(SIZE_COLOR[size]!)}
        >
          {size} · {lines}
        </Badge>
      </div>
      <div style={s.scoreCell}>
        {reviewed ? (
          <CircularScore score={pr.score!} size={34} stroke={3} />
        ) : (
          <span style={s.muted}>—</span>
        )}
      </div>
      <div className="dd-raise">
        {findingsTotal > 0 ? (
          <FindingsPopover
            variant="list"
            count={previewFindings?.length ?? findingsTotal}
            findings={previewFindings}
            isLoading={reviews.isLoading}
            onOpen={() => setPreviewOpened(true)}
          >
            <SeverityCounts counts={pr.severity_counts} />
          </FindingsPopover>
        ) : (
          <span style={s.muted}>—</span>
        )}
      </div>
      <div>
        <Badge dot color={st.c} bg="transparent">
          {t(`list.status.${st.labelKey}`)}
        </Badge>
      </div>
      <div>
        <RunCostBadge costUsd={pr.cost_usd} />
      </div>
      <div style={s.updatedCell}>{relativeTime(pr.updated_at)}</div>
    </div>
  );
}
