/* HomeView — `/`: sends the user to the first repo's PR list, or shows the
   "add a repository" empty state when there are none. */
"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { EmptyState, Button, Skeleton } from "@devdigest/ui";
import { AppShell } from "@/components/app-shell";
import { PageContainer } from "@/components/page-shell";
import { useRepos } from "@/lib/hooks/core";
import { s } from "./styles";

export function HomeView() {
  const t = useTranslations("home");
  const router = useRouter();
  const { data: repos, isLoading, isError } = useRepos();
  const first = repos?.[0];

  // Navigation is the side effect here: leave for the first repo once known.
  React.useEffect(() => {
    if (first) router.replace(`/repos/${first.id}/pulls`);
  }, [first, router]);

  return (
    <AppShell crumb={[{ label: t("breadcrumb") }]}>
      <PageContainer title={t("title")} subtitle={t("subtitle")}>
        {isLoading ? (
          <div style={s.loading}>
            <Skeleton height={20} width={240} />
            <Skeleton height={48} />
            <Skeleton height={48} />
          </div>
        ) : isError || !first ? (
          <EmptyState
            icon="GitBranch"
            title={t("emptyTitle")}
            body={t("emptyBody")}
            cta={t("emptyCta")}
            onCta={() => router.push("/onboarding")}
          />
        ) : (
          <div>
            <p style={s.redirecting}>{t("redirecting")}</p>
            <Button kind="primary" onClick={() => router.push(`/repos/${first.id}/pulls`)}>
              {t("open", { name: first.full_name })}
            </Button>
          </div>
        )}
      </PageContainer>
    </AppShell>
  );
}
