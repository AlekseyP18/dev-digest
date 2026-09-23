/* /repos/:repoId/pulls/:number — PR detail. Route entry only: the screen is
   PrDetailView (client; reads ?tab / ?trace, hence the Suspense boundary). */
import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { PageFallback } from "@/components/page-shell";
import { PrDetailView } from "./_components/PrDetailView";

type Params = Promise<{ repoId: string; number: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { number } = await params;
  const t = await getTranslations("meta");
  return { title: t("prDetail", { number }) };
}

export default async function PrDetailPage({ params }: { params: Params }) {
  const { repoId, number } = await params;
  const prNumber = Number(number);
  if (!Number.isInteger(prNumber) || prNumber <= 0) notFound();
  return (
    <Suspense fallback={<PageFallback />}>
      <PrDetailView repoId={repoId} number={prNumber} />
    </Suspense>
  );
}
