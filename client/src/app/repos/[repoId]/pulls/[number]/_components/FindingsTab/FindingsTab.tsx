/* FindingsTab — the PR's "Agent runs" tab: live run log, timeline of runs and
   commits, and one accordion per review run. Owns which accordions are open and
   which one receives the findings keyboard shortcuts. */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Icon, Badge, Button, SectionLabel, EmptyState } from "@devdigest/ui";
import type { PrCommit } from "@devdigest/shared";
import {
  useCancelRun,
  useDeleteRun,
  usePrActiveRuns,
  usePrReviews,
  usePrRuns,
  useRunSettled,
} from "@/lib/hooks/reviews";
import { useConfirm } from "@/lib/confirm";
import { RunStatus } from "../RunStatus";
import { RunHistory } from "../RunHistory";
import { ReviewRunAccordion, reviewRunDomId } from "../ReviewRunAccordion";
import { activeReviewId, lethalTrifectaFindings, reviewsByRunId, seenDefaults } from "./helpers";
import { s } from "./styles";

interface FindingsTabProps {
  prId: string;
  prCommits: PrCommit[];
  /** owner/repo + head sha — used to deep-link a finding's file:line to GitHub. */
  repoFullName?: string | null;
  headSha?: string | null;
  onOpenTrace: (runId: string) => void;
}

export function FindingsTab({ prId, prCommits, repoFullName, headSha, onOpenTrace }: FindingsTabProps) {
  const t = useTranslations("prReview.findingsTab");
  const tDetail = useTranslations("prReview.detail");
  const confirm = useConfirm();

  const { data: reviews = [] } = usePrReviews(prId);
  const { data: prRuns = [] } = usePrRuns(prId);
  const { data: activeRuns = [] } = usePrActiveRuns(prId);
  const liveRunIds = activeRuns.map((r) => r.run_id);
  const cancel = useCancelRun();
  const deleteRun = useDeleteRun(prId);
  const onRunSettled = useRunSettled(prId);

  const byRunId = React.useMemo(() => reviewsByRunId(reviews), [reviews]);
  const lethalTrifecta = lethalTrifectaFindings(reviews);

  // A run's default (open iff it was the newest when it first appeared) is fixed
  // at that moment, so a newer run arriving doesn't collapse the one being read.
  // Explicit toggles override it. Recorded during render (React's "adjust state
  // when props change" pattern), not in an effect.
  const [openState, setOpenState] = React.useState<{ seen: Record<string, boolean>; owner: string | null }>({
    seen: {},
    owner: null,
  });
  const [openOverrides, setOpenOverrides] = React.useState<Record<string, boolean>>({});
  if (reviews.some((r) => !(r.id in openState.seen))) {
    const next = seenDefaults(reviews, openState.seen);
    // The first run open by default also owns the shortcuts until the user opens another.
    const owner = openState.owner ?? reviews.find((r) => next[r.id])?.id ?? null;
    setOpenState({ seen: next, owner });
  }
  const isOpen = (reviewId: string) =>
    openOverrides[reviewId] ?? openState.seen[reviewId] ?? reviewId === reviews[0]?.id;
  const setOpen = (reviewId: string, open: boolean) => {
    setOpenOverrides((prev) => ({ ...prev, [reviewId]: open }));
    if (open) setOpenState((prev) => ({ ...prev, owner: reviewId }));
  };
  const shortcutsReviewId = activeReviewId(reviews, isOpen, openState.owner);

  // Timeline → Review runs: open that run's accordion and scroll it into view.
  const goToReview = (runId: string) => {
    const review = byRunId.get(runId);
    if (!review) return;
    setOpen(review.id, true);
    requestAnimationFrame(() =>
      document.getElementById(reviewRunDomId(runId))?.scrollIntoView({ behavior: "smooth", block: "start" }),
    );
  };

  const onDeleteRun = async (runId: string) => {
    if (await confirm({ title: tDetail("deleteRunConfirm"), danger: true })) deleteRun.mutate(runId);
  };

  const reviewRunning = liveRunIds.length > 0;

  return (
    <section>
      {reviewRunning && (
        <div style={s.liveRunSection}>
          <SectionLabel
            icon="Sparkles"
            right={
              <div style={s.cancelActions}>
                <Button
                  kind="danger"
                  size="sm"
                  icon="X"
                  loading={cancel.isPending}
                  onClick={() => liveRunIds.forEach((id) => cancel.mutate(id))}
                >
                  {t("cancel")}
                </Button>
                <Button kind="ghost" size="sm" icon="FileText" onClick={() => onOpenTrace(liveRunIds[0]!)}>
                  {t("openTrace")}
                </Button>
              </div>
            }
          >
            {t("liveReview")}
          </SectionLabel>
          <RunStatus runIds={liveRunIds} onDone={onRunSettled} />
        </div>
      )}

      {reviewRunning && (
        <div style={s.reviewInProgress}>
          <Icon.RefreshCw size={16} style={s.spinner} />
          <span style={s.reviewInProgressText}>{t("inProgressTitle")}</span>
          <span style={s.reviewInProgressSub}>{t("inProgressBody")}</span>
        </div>
      )}

      {lethalTrifecta.length > 0 && (
        <div style={s.lethalTrifecta}>
          <Icon.Shield size={16} style={s.lethalIcon} />
          <span style={s.lethalTrifectaTitle}>{t("lethalTrifecta")}</span>
          <Badge color="var(--crit)" bg="transparent">
            {t("lethalTrifectaCount", { count: lethalTrifecta.length })}
          </Badge>
        </div>
      )}

      {(prRuns.length > 0 || prCommits.length > 0) && (
        <div style={s.timelineSection}>
          <SectionLabel icon="Activity" right={<span style={s.hint}>{t("timelineHint")}</span>}>
            {t("timeline")}
          </SectionLabel>
          <RunHistory
            runs={prRuns}
            commits={prCommits}
            onOpenTrace={onOpenTrace}
            onGoToReview={goToReview}
            onDelete={onDeleteRun}
            reviewsByRunId={byRunId}
          />
        </div>
      )}

      <SectionLabel icon="AlertOctagon" right={<span style={s.hint}>{t("reviewRunsHint")}</span>}>
        {t("reviewRuns")}
      </SectionLabel>
      {reviews.length === 0
        ? !reviewRunning && <EmptyState icon="Sparkles" title={t("emptyTitle")} body={t("emptyBody")} />
        : reviews.map((review) => (
            <ReviewRunAccordion
              key={review.id}
              review={review}
              prId={prId}
              open={isOpen(review.id)}
              onOpenChange={(open) => setOpen(review.id, open)}
              shortcutsEnabled={review.id === shortcutsReviewId}
              repoFullName={repoFullName}
              headSha={headSha}
            />
          ))}
    </section>
  );
}
