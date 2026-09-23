/* useFindingShortcuts — j/k moves the focused finding, a/d accepts/dismisses it.
   Listens on window, so only ONE panel on the page may enable it at a time
   (FindingsTab passes `enabled` to the active run's panel only). */
"use client";

import React from "react";
import type { FindingActionKind, FindingRecord } from "@devdigest/shared";
import { G_NAV_PREFIX, G_NAV_TIMEOUT_MS, isTextInput } from "@/lib/keyboard";
import { KEY_TO_ACTION } from "./constants";

export function useFindingShortcuts({
  enabled,
  shown,
  focusIdx,
  setFocusIdx,
  onAction,
}: {
  enabled: boolean;
  shown: FindingRecord[];
  focusIdx: number;
  setFocusIdx: React.Dispatch<React.SetStateAction<number>>;
  onAction: (finding: FindingRecord, action: FindingActionKind) => void;
}) {
  // Latest values without re-subscribing the listener on every render.
  const latest = React.useRef({ shown, focusIdx, onAction });
  React.useLayoutEffect(() => {
    latest.current = { shown, focusIdx, onAction };
  });

  React.useEffect(() => {
    if (!enabled) return;
    let gPressedAt = 0;
    const handler = (e: KeyboardEvent) => {
      if (isTextInput(e.target) || e.metaKey || e.ctrlKey || e.altKey) return;
      // The key after `g` completes the shell's navigation chord (`g a` → Agents).
      if (e.key === G_NAV_PREFIX) {
        gPressedAt = e.timeStamp;
        return;
      }
      const inChord = gPressedAt > 0 && e.timeStamp - gPressedAt < G_NAV_TIMEOUT_MS;
      gPressedAt = 0;
      if (inChord) return;

      const { shown: list, focusIdx: idx, onAction: act } = latest.current;
      if (e.key === "j") setFocusIdx((i) => Math.min(i + 1, list.length - 1));
      else if (e.key === "k") setFocusIdx((i) => Math.max(i - 1, 0));
      else {
        const action = KEY_TO_ACTION[e.key];
        const target = list[idx];
        if (action && target) act(target, action);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [enabled, setFocusIdx]);
}
