"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Badge, Icon, CircularScore } from "@devdigest/ui";
import type { RunSummary, PrCommit, ReviewRecord } from "@devdigest/shared";
import { RunCostBadge } from "@/components/run-cost-badge";
import { FindingsPopover, SeverityCounts } from "@/components/finding-severity";
import { countBySeverity } from "@/lib/severity";
import { runOutcome } from "@/lib/run-outcome";
import { formatTime } from "@/lib/format-date";
import { OUTCOME_STYLE } from "./constants";
import { buildTimeline, runTokens } from "./helpers";
import { s } from "./styles";

/**
 * PR timeline — every agent run interleaved with the PR's commits, newest-first
 * and DB-backed so it survives reload. Showing commits between runs makes it
 * clear which commit each review ran against. Failed runs show their error
 * inline; clicking a run row opens its trace.
 *
 * The badge reflects the review OUTCOME, not just the run lifecycle (see
 * `runOutcome`): a finished run that found blockers reads "rejected" (red),
 * never a green "done".
 */
export function RunHistory({
  runs,
  commits = [],
  onOpenTrace,
  onGoToReview,
  onDelete,
  reviewsByRunId,
}: {
  runs: RunSummary[];
  commits?: PrCommit[];
  /** Open the trace + log drawer for a run (the logs icon). */
  onOpenTrace: (runId: string) => void;
  /** Jump to this run's inline review accordion below (clicking the agent name). */
  onGoToReview?: (runId: string) => void;
  onDelete?: (runId: string) => void;
  /** The run's persisted review (by run_id) — its findings drive the severity
   *  icons + hover popover. Runs without one fall back to the plain count. */
  reviewsByRunId?: Map<string, ReviewRecord>;
}) {
  const t = useTranslations("prReview");
  if (runs.length === 0 && commits.length === 0) return null;

  return (
    <div style={s.list}>
      {buildTimeline(runs, commits).map((item) => {
        if (item.kind === "commit") {
          const c = item.commit;
          return (
            <div key={`commit:${c.sha}`} style={s.commitRow}>
              <Icon.GitCommit size={15} style={s.commitIcon} />
              <span className="mono" style={s.commitSha}>
                {c.sha.slice(0, 7)}
              </span>
              <span style={s.commitMessage} title={c.message}>
                {c.message.split("\n")[0]}
              </span>
              <span style={s.commitMeta}>{c.author}</span>
              {c.committed_at && <span style={s.commitMeta}>{formatTime(c.committed_at)}</span>}
            </div>
          );
        }

        const r = item.run;
        const outcome = runOutcome(r);
        const look = OUTCOME_STYLE[outcome];
        const settled = r.status === "done";
        const review = reviewsByRunId?.get(r.run_id);
        return (
          <div key={`run:${r.run_id}`} style={s.row}>
            <Badge color={look.color} bg={look.bg} icon={look.icon}>
              {t(`runStatus.${outcome}`)}
            </Badge>
            {settled && r.score != null && <CircularScore score={r.score} size={30} stroke={3} />}
            <div style={s.runBody}>
              <div style={s.runTitle}>
                <button
                  type="button"
                  onClick={() => onGoToReview?.(r.run_id)}
                  title={t("timeline.goToReview")}
                  style={s.agentLink(!!onGoToReview)}
                >
                  {r.agent_name ?? t("reviewRun.agentFallback")}
                </button>{" "}
                <span className="mono" style={s.model}>
                  {r.provider}/{r.model}
                </span>
              </div>
              {r.status === "failed" && r.error && (
                <div style={s.error} title={r.error}>
                  {r.error}
                </div>
              )}
              {settled && (
                <div style={s.findings}>
                  {review && review.findings.length > 0 ? (
                    <FindingsPopover findings={review.findings} count={review.findings.length} variant="run">
                      <SeverityCounts counts={countBySeverity(review.findings)} />
                    </FindingsPopover>
                  ) : (
                    t("runStatus.findings", { count: r.findings_count ?? 0 })
                  )}
                  {(r.blockers ?? 0) > 0 ? t("runStatus.blockers", { count: r.blockers ?? 0 }) : ""}
                </div>
              )}
            </div>
            <div style={s.meta}>
              {r.ran_at && <span>{formatTime(r.ran_at)}</span>}
              {settled && (
                <RunCostBadge variant="detailed" costUsd={r.cost_usd} tokens={runTokens(r)} style={s.cost} />
              )}
            </div>
            <button
              type="button"
              title={t("timeline.openTrace")}
              aria-label={t("timeline.openTrace")}
              onClick={() => onOpenTrace(r.run_id)}
              style={s.iconBtn}
            >
              <Icon.FileText size={13} />
            </button>
            {onDelete && r.status !== "running" && (
              <button
                type="button"
                aria-label={t("timeline.deleteRun")}
                title={t("timeline.deleteRun")}
                onClick={() => onDelete(r.run_id)}
                style={s.deleteBtn}
              >
                <Icon.Trash size={13} />
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
