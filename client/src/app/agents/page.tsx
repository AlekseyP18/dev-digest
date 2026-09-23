/* /agents — Agents list. Route entry only: the screen is AgentsListView. */
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { AgentsListView } from "./_components/AgentsListView";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("meta");
  return { title: t("agents") };
}

export default function AgentsPage() {
  return <AgentsListView />;
}
