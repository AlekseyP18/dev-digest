import type { CSSProperties } from "react";

export const s = {
  box: (visible: boolean): CSSProperties => ({
    display: visible ? "flex" : "none",
    justifyContent: "center",
    background: "var(--bg-elevated)",
    border: "1px solid var(--border)",
    borderRadius: 8,
    padding: 12,
    overflowX: "auto",
  }),
} as const;
