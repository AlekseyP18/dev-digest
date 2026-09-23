/* /repos/:repoId/pulls — PR list. Route entry only: the screen is PullsListView
   (client; reads ?status / ?q / ?sort, hence the Suspense boundary). */
import type { Metadata } from "next";
import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { PageFallback } from "@/components/page-shell";
import { PullsListView } from "./_components/PullsListView";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("meta");
  return { title: t("pulls") };
}

export default async function PullsPage({ params }: { params: Promise<{ repoId: string }> }) {
  const { repoId } = await params;
  return (
    <Suspense fallback={<PageFallback />}>
      <PullsListView repoId={repoId} />
    </Suspense>
  );
}
