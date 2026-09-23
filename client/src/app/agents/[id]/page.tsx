/* /agents/:id — Agent editor. Route entry only: the screen is AgentEditorView
   (client; reads ?tab, hence the Suspense boundary). */
import type { Metadata } from "next";
import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { PageFallback } from "@/components/page-shell";
import { AgentEditorView } from "./_components/AgentEditorView";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("meta");
  return { title: t("agentEditor") };
}

export default async function AgentEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <Suspense fallback={<PageFallback />}>
      <AgentEditorView id={id} />
    </Suspense>
  );
}
