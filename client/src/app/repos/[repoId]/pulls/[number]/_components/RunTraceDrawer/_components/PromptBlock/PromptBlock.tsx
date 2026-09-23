/* PromptBlock — one labelled, collapsible prompt segment with copy + fullscreen
   actions; fullscreen opens PromptModalBody in a Modal. */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Button, Icon, Modal } from "@devdigest/ui";
import { COPIED_FEEDBACK_MS } from "../../constants";
import { s } from "../../styles";
import { PromptModalBody } from "../PromptModalBody";

export function PromptBlock({ label, text, color }: { label: string; text: string; color: string }) {
  const t = useTranslations("runs");
  const [open, setOpen] = React.useState(false);
  const [full, setFull] = React.useState(false);
  const [copied, setCopied] = React.useState(false);
  const copiedTimer = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  React.useEffect(() => () => clearTimeout(copiedTimer.current), []);
  const copy = () => {
    void navigator.clipboard?.writeText(text || "");
    setCopied(true);
    clearTimeout(copiedTimer.current);
    copiedTimer.current = setTimeout(() => setCopied(false), COPIED_FEEDBACK_MS);
  };
  return (
    <div style={s.promptRow}>
      {/* The whole row toggles on click; the label button gives keyboard access. */}
      <div onClick={() => setOpen((o) => !o)} style={s.promptHead}>
        <button type="button" aria-expanded={open} style={s.promptToggleBtn}>
          <span style={s.promptDot(color)} />
          <span style={s.promptLabel}>{label}</span>
        </button>
        <span style={s.promptActions}>
          <button
            type="button"
            title={t("trace.prompt.copy")}
            aria-label={t("trace.prompt.copy")}
            onClick={(e) => {
              e.stopPropagation();
              copy();
            }}
            style={s.miniBtn}
          >
            {copied ? <Icon.Check size={12} /> : <Icon.Copy size={12} />}
          </button>
          <button
            type="button"
            title={t("trace.prompt.fullscreen")}
            aria-label={t("trace.prompt.fullscreen")}
            onClick={(e) => {
              e.stopPropagation();
              setFull(true);
            }}
            style={s.miniBtn}
          >
            <Icon.ExternalLink size={12} />
          </button>
          <span style={s.promptState}>
            {open ? t("trace.collapse") : t("trace.expand")}
          </span>
        </span>
      </div>
      {open && (
        <pre className="mono" style={s.promptPre}>
          {text || "—"}
        </pre>
      )}
      {full && (
        <Modal
          width={1200}
          title={label}
          onClose={() => setFull(false)}
          footer={
            <Button kind="secondary" size="sm" icon={copied ? "Check" : "Copy"} onClick={copy}>
              {copied ? t("drawer.copied") : t("trace.prompt.copy")}
            </Button>
          }
        >
          <PromptModalBody text={text} />
        </Modal>
      )}
    </div>
  );
}
