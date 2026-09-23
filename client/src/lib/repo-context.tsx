/* repo-context.tsx — tracks the active repo for the shell + :repoId routing.
   Priority: repoId in the URL path > localStorage > first repo from the API. */
"use client";

import React from "react";
import { usePathname } from "next/navigation";
import { useRepos } from "./hooks/core";
import type { Repo } from "./types";

const STORAGE_KEY = "dd-repo";

interface RepoContextValue {
  repoId: string | null;
  setRepoId: (id: string) => void;
  repos: Repo[];
  activeRepo: Repo | null;
  reposLoaded: boolean;
}

const RepoCtx = React.createContext<RepoContextValue>({
  repoId: null,
  setRepoId: () => {},
  repos: [],
  activeRepo: null,
  reposLoaded: false,
});

function repoIdFromPath(pathname: string | null): string | null {
  if (!pathname) return null;
  const m = pathname.match(/^\/repos\/([^/]+)/);
  return m ? decodeURIComponent(m[1]!) : null;
}

// localStorage as an external store: read during render (no effect + setState),
// null on the server, and in sync across tabs via the `storage` event.
const storedRepo = {
  listeners: new Set<() => void>(),
  subscribe(cb: () => void) {
    storedRepo.listeners.add(cb);
    window.addEventListener("storage", cb);
    return () => {
      storedRepo.listeners.delete(cb);
      window.removeEventListener("storage", cb);
    };
  },
  get(): string | null {
    try {
      return localStorage.getItem(STORAGE_KEY);
    } catch {
      return null;
    }
  },
  set(id: string) {
    try {
      localStorage.setItem(STORAGE_KEY, id);
    } catch {
      /* storage unavailable (private mode) — keep the in-memory choice via the URL */
    }
    storedRepo.listeners.forEach((cb) => cb());
  },
};

export function RepoProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { data: repos, isSuccess: reposLoaded } = useRepos();
  const stored = React.useSyncExternalStore(storedRepo.subscribe, storedRepo.get, () => null);

  const value = React.useMemo<RepoContextValue>(() => {
    const list = repos ?? [];
    const repoId = repoIdFromPath(pathname) ?? stored ?? list[0]?.id ?? null;
    return {
      repoId,
      setRepoId: storedRepo.set,
      repos: list,
      activeRepo: list.find((r) => r.id === repoId) ?? null,
      reposLoaded,
    };
  }, [repos, pathname, stored, reposLoaded]);

  return <RepoCtx.Provider value={value}>{children}</RepoCtx.Provider>;
}

export function useActiveRepo() {
  return React.useContext(RepoCtx);
}

/**
 * True once the repos list has loaded and the given :repoId matches none of
 * them — i.e. a stale/invalid repo in the URL ("no repo selected"). Repo-scoped
 * pages use this to show a friendly empty state instead of a "Repo not found"
 * error. Returns false while repos are still loading (avoids a flash) and on a
 * repos fetch failure (let the page surface its real error in that case).
 */
export function useRepoNotFound(repoId: string | null | undefined): boolean {
  const { repos, reposLoaded } = useActiveRepo();
  return reposLoaded && repoId != null && !repos.some((r) => r.id === repoId);
}
