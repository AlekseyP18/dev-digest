/* ReviewRunAccordion — one collapsible review RUN (a single agent's pass over
   the PR). Header shows agent + verdict + counts + score + when it ran; the
   body holds that run's VerdictBanner summary and its own FindingsPanel. A PR
   can have many runs (different agents / re-runs over time) — each is separate
   and collapsible so older runs don't bury the latest. Open state is controlled
   by FindingsTab (timeline navigation), or local when `open` is omitted. */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Icon, Badge } from "@devdigest/ui";
import type { ReviewRecord, Verdict } from "@devdigest/shared";
import { FindingsPopover, SeverityCounts } from "@/components/finding-severity";
import { useDeleteReview } from "@/lib/hooks/reviews";
import { useConfirm } from "@/lib/confirm";
import { countBlockers, countBySeverity } from "@/lib/severity";
import { formatDateTime } from "@/lib/format-date";
import { FindingsPanel } from "../FindingsPanel";
import { VerdictBanner } from "../VerdictBanner";
import { VERDICT_COLOR, VERDICT_COLOR_FALLBACK, reviewRunDomId } from "./constants";
import { s } from "./styles";

export function ReviewRunAccordion({
  review,
  prId,
  defaultOpen = false,
  open: openProp,
  onOpenChange,
  shortcutsEnabled = false,
  repoFullName,
  headSha,
}: {
  review: ReviewRecord;
  prId: string;
  /** Initial state when uncontrolled. */
  defaultOpen?: boolean;
  /** Controlled open state (FindingsTab); omit for a self-managed accordion. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Enable the findings panel's j/k/a/d keys (only on the active run). */
  shortcutsEnabled?: boolean;
  repoFullName?: string | null;
  headSha?: string | null;
}) {
  const t = useTranslations("prReview.reviewRun");
  const confirm = useConfirm();
  const [localOpen, setLocalOpen] = React.useState(defaultOpen);
  const open = openProp ?? localOpen;
  const toggle = () => {
    const next = !open;
    if (openProp === undefined) setLocalOpen(next);
    onOpenChange?.(next);
  };

  const del = useDeleteReview(prId);
  const findings = review.findings;
  const blockers = countBlockers(findings);
  const agentName = review.agent_name ?? t("agentFallback");
  const verdict = review.verdict as Verdict | null;

  const onDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (await confirm({ title: t("deleteConfirm", { agent: agentName }), danger: true })) {
      del.mutate(review.id);
    }
  };

  return (
    <div id={review.run_id ? reviewRunDomId(review.run_id) : undefined} style={s.root}>
      {/* The whole header toggles on click; the button gives keyboard + screen-reader access. */}
      <div onClick={toggle} style={s.header}>
        <button type="button" aria-expanded={open} style={s.toggle}>
          <Icon.Cpu size={15} style={s.agentIcon} />
          <span style={s.agentName}>{agentName}</span>
          {verdict && (
            <Badge color={VERDICT_COLOR[verdict] ?? VERDICT_COLOR_FALLBACK} bg="transparent">
              {t(`verdict.${verdict}`)}
            </Badge>
          )}
        </button>
        <span style={s.counts}>
          {findings.length > 0 ? (
            <FindingsPopover variant="run" findings={findings} count={findings.length}>
              <SeverityCounts counts={countBySeverity(findings)} />
            </FindingsPopover>
          ) : (
            t("noFindings")
          )}
          {blockers > 0 ? t("blockers", { count: blockers }) : ""}
        </span>
        <span style={s.spacer} />
        {review.score != null && (
          <Badge mono color="var(--text-secondary)">
            {review.score}
          </Badge>
        )}
        <span className="mono" style={s.when}>
          {formatDateTime(review.created_at)}
        </span>
        <button
          type="button"
          onClick={onDelete}
          disabled={del.isPending}
          title={t("delete")}
          aria-label={t("delete")}
          style={s.deleteBtn(del.isPending)}
        >
          <Icon.Trash size={14} style={del.isPending ? s.spinning : undefined} />
        </button>
        <Icon.ChevronDown size={16} style={s.chevron(open)} aria-hidden />
      </div>

      {open && (
        <div style={s.body}>
          {verdict && (
            <div style={s.verdict}>
              <VerdictBanner
                verdict={verdict}
                summary={review.summary}
                score={review.score}
                findingsCount={findings.length}
                blockers={blockers}
                agentName={review.agent_name}
              />
            </div>
          )}
          <FindingsPanel
            findings={findings}
            prId={prId}
            repoFullName={repoFullName}
            headSha={headSha}
            shortcutsEnabled={shortcutsEnabled}
          />
        </div>
      )}
    </div>
  );
}

export default ReviewRunAccordion;
