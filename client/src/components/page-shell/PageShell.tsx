/* PageShell.tsx — small helpers for route pages: a section container and the
   route-level Suspense fallback rendered inside the app shell. */
"use client";

import React from "react";
import { Skeleton } from "@devdigest/ui";
import { AppShell } from "@/components/app-shell";
import { s } from "./styles";

export function PageContainer({
  title,
  subtitle,
  actions,
  children,
}: {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div style={s.container}>
      {(title || actions) && (
        <div style={s.headerRow}>
          <div>
            {title && <h1 style={s.h1}>{title}</h1>}
            {subtitle && <p style={s.subtitle}>{subtitle}</p>}
          </div>
          {actions && <div style={s.actions}>{actions}</div>}
        </div>
      )}
      {children}
    </div>
  );
}

/**
 * Suspense fallback for a route: the real shell with a neutral skeleton, so the
 * nav stays visible while a page that reads search params hydrates.
 */
export function PageFallback() {
  return (
    <AppShell>
      <div style={s.fallback}>
        <Skeleton height={28} width={320} />
        <Skeleton height={16} width={220} />
        <Skeleton height={200} />
      </div>
    </AppShell>
  );
}
