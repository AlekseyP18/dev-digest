/* Unknown URL → friendly empty state inside the app shell. */
"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { EmptyState } from "@devdigest/ui";
import { AppShell } from "@/components/app-shell";
import { PageContainer } from "@/components/page-shell";

export default function NotFound() {
  const t = useTranslations("errors");
  const router = useRouter();
  return (
    <AppShell>
      <PageContainer>
        <EmptyState
          icon="Search"
          title={t("notFoundTitle")}
          body={t("notFoundBody")}
          cta={t("home")}
          onCta={() => router.push("/")}
        />
      </PageContainer>
    </AppShell>
  );
}
