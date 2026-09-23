/* Route error boundary: an uncaught render error in any page shows this inside
   the app shell (with Try again) instead of blanking the screen. */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { ErrorState } from "@devdigest/ui";
import { AppShell } from "@/components/app-shell";

export default function RouteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useTranslations("errors");
  React.useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <AppShell>
      <ErrorState fullScreen title={t("title")} body={error.message || t("body")} onRetry={reset} />
    </AppShell>
  );
}
