/* PrDetailView — /repos/:repoId/pulls/:number. Header + tabs (Overview, Agent
   runs, Files changed) and the run-trace drawer. Tab and open trace live in the
   query string (?tab, ?trace) so a view can be reloaded or shared. */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Skeleton, ErrorState } from "@devdigest/ui";
import { AppShell } from "@/components/app-shell";
import { RepoNotFound } from "@/components/repo-not-found";
import { usePullByNumber } from "@/lib/hooks/core";
import { usePrReviews } from "@/lib/hooks/reviews";
import { useSearchParam } from "@/lib/hooks/search-params";
import { useActiveRepo, useRepoNotFound } from "@/lib/repo-context";
import { ApiError } from "@/lib/api";
import { githubPrUrl } from "@/lib/github-urls";
import { PrDetailHeader } from "../PrDetailHeader";
import { OverviewTab } from "../OverviewTab";
import { FindingsTab } from "../FindingsTab";
import { DiffTab } from "../DiffTab";
import { RunTraceDrawer } from "../RunTraceDrawer";
import { toPrTab, totalFindingsCount } from "./helpers";
import { s } from "./styles";

export function PrDetailView({ repoId, number }: { repoId: string; number: number }) {
  const t = useTranslations("prReview");
  const { activeRepo } = useActiveRepo();
  const repoNotFound = useRepoNotFound(repoId);
  const { prId, pr, isLoading, isError, error, refetch } = usePullByNumber(repoId, number);
  const { data: reviews } = usePrReviews(prId);

  // Switching tabs replaces the page body → start at the top; opening the trace drawer keeps the position.
  const [tabParam, setTabParam] = useSearchParam("tab", { scroll: true });
  const [traceRunId, setTraceRunId] = useSearchParam("trace");
  const tab = toPrTab(tabParam);

  // null until the repos list loads — then used for github.com deep-links.
  const repoFullName = activeRepo?.full_name ?? null;
  const crumb = [
    { label: repoFullName ?? repoId, mono: true, href: `/repos/${repoId}/pulls` },
    { label: t("list.breadcrumb"), href: `/repos/${repoId}/pulls` },
    { label: `#${number}`, mono: true },
  ];

  // Stale/unknown :repoId → friendly empty state instead of a 404 error.
  if (repoNotFound) {
    return (
      <AppShell crumb={crumb}>
        <RepoNotFound />
      </AppShell>
    );
  }

  if (isLoading) {
    return (
      <AppShell crumb={crumb}>
        <div style={s.loading}>
          <Skeleton height={28} width={420} />
          <Skeleton height={16} width={300} />
          <Skeleton height={200} />
        </div>
      </AppShell>
    );
  }

  if (isError || !pr || !prId) {
    return (
      <AppShell crumb={crumb}>
        <ErrorState
          fullScreen
          title={t("detail.errorTitle")}
          body={error instanceof ApiError ? error.message : t("detail.errorBody", { number })}
          onRetry={() => refetch()}
        />
      </AppShell>
    );
  }

  const traceReview = traceRunId ? reviews?.find((r) => r.run_id === traceRunId) : undefined;

  return (
    <AppShell crumb={crumb}>
      <PrDetailHeader
        pr={pr}
        prId={prId}
        tab={tab}
        findingsCount={totalFindingsCount(reviews)}
        githubUrl={repoFullName ? githubPrUrl(repoFullName, pr.number) : null}
        onSetTab={setTabParam}
        onRunStart={() => setTabParam("findings")}
      />

      <div style={s.body}>
        {tab === "overview" && <OverviewTab prBody={pr.body} />}
        {tab === "findings" && (
          <FindingsTab
            prId={prId}
            prCommits={pr.commits}
            repoFullName={repoFullName}
            headSha={pr.head_sha}
            onOpenTrace={setTraceRunId}
          />
        )}
        {tab === "diff" && (
          <DiffTab prId={prId} filesCount={pr.files_count} files={pr.files} canComment={pr.status === "open"} />
        )}
      </div>

      {traceRunId && (
        <RunTraceDrawer
          runId={traceRunId}
          prNumber={pr.number}
          findings={traceReview?.findings ?? []}
          agentName={traceReview?.agent_name ?? null}
          onClose={() => setTraceRunId(null)}
        />
      )}
    </AppShell>
  );
}
