import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages, getTranslations } from "next-intl/server";
import "./globals.css";
import { Providers } from "../lib/providers";
import { themeNoFlashScript } from "../lib/theme";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("meta");
  return {
    title: { default: t("appName"), template: `%s · ${t("appName")}` },
    description: t("description"),
  };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  const messages = await getMessages();
  return (
    <html lang={locale} data-theme="dark" data-density="regular" suppressHydrationWarning>
      <head>
        {/* set theme before paint to avoid FOUC */}
        <script dangerouslySetInnerHTML={{ __html: themeNoFlashScript }} />
      </head>
      {/* suppressHydrationWarning: browser extensions (Grammarly, translators, …)
          inject attributes like data-gr-ext-installed onto <body> before React
          hydrates. This suppresses ONLY this element's own attribute mismatch
          (one level deep) — real mismatches in descendants are still reported. */}
      <body suppressHydrationWarning>
        <NextIntlClientProvider locale={locale} messages={messages}>
          {/* No app-wide Suspense: pages that read search params wrap their own
              view in <Suspense fallback={<PageFallback />}>. */}
          <Providers>{children}</Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
