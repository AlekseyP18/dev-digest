/** Tabs of the PR detail screen, as stored in `?tab=`. */
export const PR_TABS = ["overview", "findings", "diff"] as const;
export type PrTab = (typeof PR_TABS)[number];
export const DEFAULT_PR_TAB: PrTab = "overview";
