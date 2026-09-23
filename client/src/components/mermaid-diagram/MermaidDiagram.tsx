"use client";

import React from "react";
import { s } from "./styles";

let seq = 0;

/** Mermaid diagrams must start with a known graph keyword. Anything else
 *  (prose, JSON like {"type":"Buffer"...}, empty) is not a diagram → skip. */
const MERMAID_RE =
  /^\s*(flowchart|graph|sequenceDiagram|classDiagram|stateDiagram(-v2)?|erDiagram|journey|gantt|pie|mindmap|timeline|gitGraph|quadrantChart|requirementDiagram|C4Context)\b/;

function looksLikeMermaid(src: string): boolean {
  return MERMAID_RE.test(src.trim());
}

/**
 * Renders a mermaid diagram string to inline SVG. mermaid is imported lazily
 * (client-only). We VALIDATE with mermaid.parse({suppressErrors}) before
 * rendering — mermaid otherwise injects a "Syntax error" bomb graphic into the
 * DOM on bad input instead of throwing. Junk/unparseable input renders nothing.
 * Starter scaffolding: no screen uses it yet; lessons (brief / onboarding
 * diagrams) mount it.
 */
export function MermaidDiagram({ chart }: { chart: string }) {
  const ref = React.useRef<HTMLDivElement>(null);
  const src = (chart ?? "").trim();
  const isCandidate = looksLikeMermaid(src);
  // Result of the async render, tagged with the source it belongs to; a new
  // `chart` is "pending" (or "invalid" if it's clearly not mermaid) until then.
  const [result, setResult] = React.useState<{ src: string; status: "ok" | "invalid" } | null>(null);
  const status = !isCandidate ? "invalid" : result?.src === src ? result.status : "pending";

  React.useEffect(() => {
    if (!isCandidate) return;
    let cancelled = false;
    (async () => {
      try {
        const mermaid = (await import("mermaid")).default;
        mermaid.initialize({ startOnLoad: false, theme: "dark", securityLevel: "strict" });
        // parse first; suppressErrors → returns false (no throw, no DOM bomb).
        const valid = await mermaid.parse(src, { suppressErrors: true });
        if (cancelled) return;
        if (!valid) {
          setResult({ src, status: "invalid" });
          return;
        }
        const { svg } = await mermaid.render(`dd-mermaid-${seq++}`, src);
        if (cancelled) return;
        if (ref.current) ref.current.innerHTML = svg;
        setResult({ src, status: "ok" });
      } catch {
        if (!cancelled) setResult({ src, status: "invalid" });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [src, isCandidate]);

  // Not a (valid) diagram → render nothing rather than a broken box.
  if (status === "invalid") return null;

  return <div ref={ref} style={s.box(status === "ok")} />;
}

export default MermaidDiagram;
