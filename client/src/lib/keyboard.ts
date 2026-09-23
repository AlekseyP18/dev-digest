/* keyboard.ts — shared rules for single-key shortcuts on window. The app shell
   owns `g`-then-key navigation; page-level shortcuts must ignore the key that
   completes such a chord (`g a` = go to Agents, not "accept finding"). */

/** First key of a navigation chord (`g p`, `g a`, `g ,`). */
export const G_NAV_PREFIX = "g";

/** Window (ms) to press the second key of a `g`-then-key navigation chord. */
export const G_NAV_TIMEOUT_MS = 1200;

/** Whether an event target is a text-entry element (guards typing-aware shortcuts). */
export function isTextInput(el: EventTarget | null): boolean {
  const node = el as HTMLElement | null;
  return (
    !!node &&
    (node.tagName === "INPUT" || node.tagName === "TEXTAREA" || node.isContentEditable)
  );
}
