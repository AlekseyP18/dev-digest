/* PullsListView — /repos/:repoId/pulls. Filter chips, search and sort live in
   the query string (?status, ?q, ?sort) so the view survives reload and can be
   shared. Ported from screen_dashboard.jsx. */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Skeleton, EmptyState, ErrorState, AutoTriggerStatus } from "@devdigest/ui";
import { AppShell } from "@/components/app-shell";
import { RepoNotFound } from "@/components/repo-not-found";
import { usePulls, useRefreshRepo } from "@/lib/hooks/core";
import { useSearchParam } from "@/lib/hooks/search-params";
import { useActiveRepo, useRepoNotFound } from "@/lib/repo-context";
import { ApiError } from "@/lib/api";
import { COLUMN_KEYS, DEFAULT_STATUS_FILTER, QUERY_URL_DEBOUNCE_MS, SKELETON_ROWS } from "./constants";
import { filterPulls, pullCounts, sortPulls, toSortKey } from "./helpers";
import { s } from "./styles";
import { PRRow } from "./_components/PRRow";
import { FilterBar } from "./_components/FilterBar";

export function PullsListView({ repoId }: { repoId: string }) {
  const t = useTranslations("prReview");
  const { activeRepo } = useActiveRepo();
  const repoNotFound = useRepoNotFound(repoId);
  const { data: pulls, isLoading, isError, error, refetch } = usePulls(repoId);
  const refresh = useRefreshRepo();

  const [statusParam, setStatus] = useSearchParam("status");
  const [sortParam, setSort] = useSearchParam("sort");
  const [queryParam, setQueryParam] = useSearchParam("q");
  const status = statusParam ?? DEFAULT_STATUS_FILTER;
  const sort = toSortKey(sortParam);

  // The box filters instantly; the URL catches up after a pause in typing.
  // When ?q changes to something this view didn't write (nav link, back/forward),
  // the URL wins and replaces the box's text. `written` is our last URL write;
  // `seenUrl` detects the change (the router applies our own write a bit later).
  const urlQuery = queryParam ?? "";
  const [query, setQuery] = React.useState(urlQuery);
  const [written, setWritten] = React.useState(urlQuery);
  const [seenUrl, setSeenUrl] = React.useState(urlQuery);
  if (urlQuery !== seenUrl) {
    setSeenUrl(urlQuery);
    if (urlQuery !== written) {
      setWritten(urlQuery);
      setQuery(urlQuery);
    }
  }
  React.useEffect(() => {
    if (query === urlQuery) return;
    const id = setTimeout(() => {
      setWritten(query);
      setQueryParam(query);
    }, QUERY_URL_DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [query, urlQuery, setQueryParam]);

  const all = pulls ?? [];
  const visible = sortPulls(filterPulls(all, { status, query }), sort);
  const counts = pullCounts(all);
  const crumb = [{ label: activeRepo?.full_name ?? repoId, mono: true }, { label: t("list.breadcrumb") }];

  // Stale/unknown :repoId → friendly empty state instead of a 404 error.
  if (repoNotFound) {
    return (
      <AppShell crumb={crumb}>
        <RepoNotFound />
      </AppShell>
    );
  }

  return (
    <AppShell crumb={crumb}>
      <div style={s.pageHeader}>
        <div>
          <h1 style={s.pageTitle}>{t("list.title")}</h1>
          <p style={s.pageSubtitle}>
            {pulls ? t("list.summary", { open: counts.open, needsReview: counts.needsReview }) : t("list.loading")}
          </p>
        </div>
        <div style={s.headerActions}>
          <AutoTriggerStatus on={false} />
        </div>
      </div>

      <div style={s.tableCard}>
        <FilterBar
          // Always explicit in the URL so "all" sticks over the needs_review default.
          active={status}
          onActive={setStatus}
          query={query}
          onQuery={setQuery}
          sort={sort}
          onSort={setSort}
          onRefresh={() => refresh.mutate(repoId)}
          refreshing={refresh.isPending}
        />
        <div style={s.headRow}>
          {COLUMN_KEYS.map((key, i) => (
            <div key={key} style={s.headCell(i === COLUMN_KEYS.length - 1)}>
              {t(`list.columns.${key}`)}
            </div>
          ))}
        </div>

        {isLoading ? (
          <div style={s.loadingStack}>
            {Array.from({ length: SKELETON_ROWS }).map((_, i) => (
              <Skeleton key={i} height={28} />
            ))}
          </div>
        ) : isError ? (
          <ErrorState
            title={t("list.errorTitle")}
            body={error instanceof ApiError ? error.message : t("list.errorBody")}
            onRetry={() => refetch()}
          />
        ) : visible.length === 0 ? (
          <EmptyState
            icon="GitPullRequest"
            title={t("list.emptyTitle")}
            body={status === "all" ? t("list.emptyAllBody") : t("list.emptyStatusBody", { status })}
          />
        ) : (
          visible.map((pr) => <PRRow key={pr.number} pr={pr} repoId={repoId} />)
        )}
      </div>
    </AppShell>
  );
}
