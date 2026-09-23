import { TABS } from "../AgentEditor/constants";

/** `?tab=` value → a known editor tab (the first tab otherwise). */
export function toEditorTab(value: string | null): string {
  return TABS.some((tb) => tb.key === value) ? value! : TABS[0]!.key;
}
