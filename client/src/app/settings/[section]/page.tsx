/* /settings/:section — Route entry only: the screen is SettingsView. */
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { SettingsView } from "./_components/SettingsView";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("meta");
  return { title: t("settings") };
}

export default async function SettingsPage({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  return <SettingsView section={section} />;
}
