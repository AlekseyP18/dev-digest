/* theme.tsx — dark/light theming via data-theme on <html>. */
"use client";

import React from "react";

type Theme = "dark" | "light";
const STORAGE_KEY = "dd-theme";

interface ThemeApi {
  theme: Theme;
  toggle: () => void;
  set: (t: Theme) => void;
}

const ThemeCtx = React.createContext<ThemeApi>({ theme: "dark", toggle: () => {}, set: () => {} });

// The source of truth is `data-theme` on <html> (set before paint by
// themeNoFlashScript), so React reads it as an external store instead of
// copying it into state in an effect.
function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => observer.disconnect();
}
const getTheme = (): Theme => (document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark");
const getServerTheme = (): Theme => "dark";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = React.useSyncExternalStore(subscribe, getTheme, getServerTheme);

  const set = React.useCallback((t: Theme) => {
    document.documentElement.setAttribute("data-theme", t);
    try {
      localStorage.setItem(STORAGE_KEY, t);
    } catch {
      /* storage unavailable (private mode) — the attribute still applies for this session */
    }
  }, []);

  const value = React.useMemo<ThemeApi>(
    () => ({ theme, set, toggle: () => set(theme === "dark" ? "light" : "dark") }),
    [theme, set],
  );

  return <ThemeCtx.Provider value={value}>{children}</ThemeCtx.Provider>;
}

export function useTheme() {
  return React.useContext(ThemeCtx);
}

/** Inline script string injected in <head> to set data-theme before paint. */
export const themeNoFlashScript = `(function(){try{var t=localStorage.getItem('dd-theme')||'dark';document.documentElement.setAttribute('data-theme',t);document.documentElement.setAttribute('data-density','regular');}catch(e){document.documentElement.setAttribute('data-theme','dark');}})();`;
