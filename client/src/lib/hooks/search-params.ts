/* search-params.ts — UI state that belongs in the URL (tabs, filters, open
   drawers): survives reload and can be shared as a link. */
"use client";

import React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

/**
 * One query-string param as state. `set(null)` removes it. Writes use
 * `router.replace`, so filter/tab changes don't pile up in browser history, and
 * keep the scroll position unless `scroll: true` (e.g. switching whole tabs).
 * Consumers must render under a <Suspense> boundary (useSearchParams).
 */
export function useSearchParam(
  key: string,
  { scroll = false }: { scroll?: boolean } = {},
): [string | null, (value: string | null) => void] {
  const search = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const value = search.get(key);

  const set = React.useCallback(
    (next: string | null) => {
      const sp = new URLSearchParams(search.toString());
      if (next == null || next === "") sp.delete(key);
      else sp.set(key, next);
      const qs = sp.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll });
    },
    [search, pathname, router, key, scroll],
  );

  return [value, set];
}
