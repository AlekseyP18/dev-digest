/* FindingsPanel — severity filter pills + hide-low-confidence + j/k navigation
   + FindingCard list, wiring the accept/dismiss action hook (A2). */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Toggle, EmptyState } from "@devdigest/ui";
import type { FindingRecord, Severity } from "@devdigest/shared";
import { countBySeverity } from "@/lib/severity";
import { FindingCard } from "../FindingCard";
import { SeverityFilterPills } from "../SeverityFilterPills";
import { useFindingAction } from "@/lib/hooks/reviews";
import { confidentFindings, visibleFindings } from "./helpers";
import { useFindingShortcuts } from "./useFindingShortcuts";
import { s } from "./styles";

export function FindingsPanel({
  findings,
  prId,
  repoFullName,
  headSha,
  shortcutsEnabled = true,
}: {
  findings: FindingRecord[];
  prId: string;
  repoFullName?: string | null;
  headSha?: string | null;
  /** j/k/a/d listen on window — enable on at most one panel per page. */
  shortcutsEnabled?: boolean;
}) {
  const t = useTranslations("prReview");
  const action = useFindingAction();
  const [hideLow, setHideLow] = React.useState(false);
  const [severity, setSeverity] = React.useState<Severity | null>(null);
  const [focusIdx, setFocusIdx] = React.useState(0);

  // Pill counts come from the list BEFORE the severity filter (but after
  // hide-low), so each pill's number equals the cards it reveals.
  const counts = React.useMemo(
    () => countBySeverity(confidentFindings(findings, hideLow)),
    [findings, hideLow],
  );
  // A filtered-to severity that no longer exists (e.g. hidden by hide-low) is dropped.
  const activeSeverity = severity && counts[severity] > 0 ? severity : null;
  const shown = React.useMemo(
    () => visibleFindings(findings, hideLow, activeSeverity),
    [findings, hideLow, activeSeverity],
  );
  const changeSeverity = (next: Severity | null) => {
    setSeverity(next);
    setFocusIdx(0);
  };

  useFindingShortcuts({
    enabled: shortcutsEnabled,
    shown,
    focusIdx,
    setFocusIdx,
    onAction: (f, act) => action.mutate({ findingId: f.id, action: act, prId }),
  });

  return (
    <div>
      <div style={s.toolbar}>
        <SeverityFilterPills counts={counts} active={activeSeverity} onChange={changeSeverity} />
        <div style={s.toggleGroup}>
          {t("panel.hideLowConfidence")}
          <Toggle on={hideLow} onChange={setHideLow} size={16} />
        </div>
      </div>

      <div style={s.list}>
        {shown.length === 0 ? (
          <EmptyState icon="Filter" title={t("panel.noMatchTitle")} body={t("panel.noMatchBody")} />
        ) : (
          shown.map((f, i) => (
            <FindingCard
              key={f.id}
              f={f}
              focused={i === focusIdx}
              defaultExpanded={i === 0}
              pending={action.isPending}
              repoFullName={repoFullName}
              headSha={headSha}
              onAction={(act) => action.mutate({ findingId: f.id, action: act, prId })}
            />
          ))
        )}
      </div>
    </div>
  );
}
