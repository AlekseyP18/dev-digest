/* RunStatus — live SSE status for in-flight review runs. Subscribes to the
   run event streams and renders the shared LiveLogStream. */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { LiveLogStream, type LogLine } from "@devdigest/ui";
import { useRunEvents } from "@/lib/hooks/reviews";
import { LOG_HEIGHT } from "./constants";
import { s } from "./styles";

export function RunStatus({
  runIds,
  onDone,
}: {
  runIds: string[];
  /** Fired once each time the streams go from running to closed. */
  onDone?: () => void;
}) {
  const t = useTranslations("prReview");
  const { events, running } = useRunEvents(runIds);
  const onDoneRef = React.useRef(onDone);
  React.useLayoutEffect(() => {
    onDoneRef.current = onDone;
  });

  // Fire on the running → settled transition only; re-renders after settling
  // (e.g. from the invalidations onDone itself triggers) must not re-fire it.
  const wasRunning = React.useRef(false);
  React.useEffect(() => {
    if (running) {
      wasRunning.current = true;
    } else if (wasRunning.current) {
      wasRunning.current = false;
      onDoneRef.current?.();
    }
  }, [running]);

  if (runIds.length === 0) return null;

  const log: LogLine[] = events.map((e) => ({
    t: e.t,
    k: e.kind as LogLine["k"],
    m: e.msg,
  }));

  return (
    <div style={s.wrap}>
      <LiveLogStream
        log={log}
        running={running}
        height={LOG_HEIGHT}
        elapsedLabel={running ? t("runStatus.elapsed", { count: runIds.length }) : undefined}
      />
    </div>
  );
}
