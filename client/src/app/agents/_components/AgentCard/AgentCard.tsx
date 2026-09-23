/* AgentCard — model chip, skills count, enabled toggle. Stats are an A5 mount;
   we render the provider/model + skill count here. When `onClick` is given the
   name is a button stretched over the card (`.dd-stretched`), so the card opens
   by mouse or keyboard; the toggle and delete stay separate controls. */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Icon, Badge, Toggle } from "@devdigest/ui";
import type { Agent } from "@devdigest/shared";
import { useDeleteAgent } from "@/lib/hooks/agents";
import { useConfirm } from "@/lib/confirm";
import { modelColor } from "./helpers";
import { s } from "./styles";

export function AgentCard({
  ag,
  active,
  skillCount,
  onClick,
  onToggle,
}: {
  ag: Agent;
  active?: boolean;
  skillCount?: number;
  onClick?: () => void;
  onToggle?: (enabled: boolean) => void;
}) {
  const t = useTranslations("agents.card");
  const confirm = useConfirm();
  const del = useDeleteAgent();
  const color = modelColor(ag.model);

  const onDelete = async () => {
    const ok = await confirm({ title: t("deleteConfirm", { name: ag.name }), body: t("deleteConfirmBody"), danger: true });
    if (ok) del.mutate(ag.id);
  };

  return (
    <div className="dd-card" style={s.card(!!active, ag.enabled)}>
      <div style={s.headerRow}>
        <div style={s.iconBox}>
          <Icon.Cpu size={15} />
        </div>
        {onClick ? (
          <button type="button" onClick={onClick} aria-current={active || undefined} className="dd-card-title dd-stretched" style={s.name}>
            {ag.name}
          </button>
        ) : (
          <span style={s.name}>{ag.name}</span>
        )}
        {onToggle && (
          <div className="dd-raise">
            <Toggle on={ag.enabled} onChange={onToggle} size={14} />
          </div>
        )}
        <button
          type="button"
          onClick={onDelete}
          disabled={del.isPending}
          title={t("delete")}
          aria-label={t("delete")}
          className="dd-raise"
          style={s.deleteBtn(del.isPending)}
        >
          <Icon.Trash size={14} style={del.isPending ? s.spinning : undefined} />
        </button>
      </div>
      <div style={s.description}>{ag.description || t("noDescription")}</div>
      <div style={s.metaRow}>
        <span className="mono" style={s.modelChip(color)}>
          {ag.model}
        </span>
        {skillCount != null && (
          <Badge color="var(--text-secondary)" icon="Sparkles">
            {t("skillCount", { count: skillCount })}
          </Badge>
        )}
      </div>
    </div>
  );
}
