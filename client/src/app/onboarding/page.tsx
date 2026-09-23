/* /onboarding — Add-repository screen. Route entry only: the screen is AddRepoView. */
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { AddRepoView } from "./_components/AddRepoView";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("meta");
  return { title: t("onboarding") };
}

export default function AddRepoPage() {
  return <AddRepoView />;
}
