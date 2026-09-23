/* hooks/reviews.ts — React Query + SSE hooks for the A2 reviewer.
   Run a review, stream RunEvents live, act on findings. */
"use client";

import React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, runEventsUrl } from "../api";
import { qk } from "./keys";
import { notify } from "../toast";
import type {
  ActiveRun,
  FindingActionKind,
  PrReviewComment,
  ReviewRecord,
  ReviewRunResponse,
  RunEvent,
  RunSummary,
} from "@devdigest/shared";

// ---- Active (in-flight) runs — server-side source of truth ----

/** In-flight runs for a PR, from the server (agent_runs where status='running').
   Survives reloads/devices; polls while anything is running so it self-clears. */
export function usePrActiveRuns(prId: string | null | undefined) {
  return useQuery({
    queryKey: qk.prActiveRuns(prId),
    queryFn: () => api.get<ActiveRun[]>(`/pulls/${prId}/runs/active`),
    enabled: !!prId,
    refetchInterval: (query) => ((query.state.data?.length ?? 0) > 0 ? 4000 : false),
  });
}

// ---- Full run history for a PR (every agent_runs row, any status) ----
/** All runs for a PR — done, failed (with error), cancelled, running. Survives
   reload (DB-backed). Polls while anything is running so it self-updates. */
export function usePrRuns(prId: string | null | undefined) {
  return useQuery({
    queryKey: qk.prRuns(prId),
    queryFn: () => api.get<RunSummary[]>(`/pulls/${prId}/runs`),
    enabled: !!prId,
    refetchInterval: (query) =>
      (query.state.data ?? []).some((r) => r.status === "running") ? 4000 : false,
  });
}

// ---- Persisted reviews + findings for a PR ----
export function usePrReviews(prId: string | null | undefined) {
  return useQuery({
    queryKey: qk.reviews(prId),
    queryFn: () => api.get<ReviewRecord[]>(`/pulls/${prId}/reviews`),
    enabled: !!prId,
  });
}

/**
 * Callback for "a run just settled (done, failed or cancelled)": refresh the
 * in-flight list, the run history and the persisted reviews of the PR, so a
 * just-failed run shows up in the timeline without a reload.
 */
export function useRunSettled(prId: string | null | undefined) {
  const qc = useQueryClient();
  return React.useCallback(() => {
    if (!prId) return;
    qc.invalidateQueries({ queryKey: qk.prActiveRuns(prId) });
    qc.invalidateQueries({ queryKey: qk.prRuns(prId) });
    qc.invalidateQueries({ queryKey: qk.reviews(prId) });
  }, [qc, prId]);
}

/** Delete one run from the PR's run history (+ its trace). */
export function useDeleteRun(prId: string | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (runId: string) => api.del<{ ok: boolean }>(`/runs/${runId}`),
    // Deleting a run also deletes the review it produced (server-side), so drop
    // both the timeline and the Review Runs list from cache.
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.prRuns(prId) });
      qc.invalidateQueries({ queryKey: qk.reviews(prId) });
    },
  });
}

/** Request cancellation of an in-flight run (takes effect at the next step). */
export function useCancelRun() {
  return useMutation({
    mutationFn: (runId: string) => api.post<{ ok: boolean }>(`/runs/${runId}/cancel`),
  });
}

/** Delete a whole review run (one agent's pass) + its findings. */
export function useDeleteReview(prId: string | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (reviewId: string) => api.del<{ ok: boolean }>(`/reviews/${reviewId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.reviews(prId) }),
  });
}

// ---- Inline review comments on the "Files changed" tab (proxied to GitHub) --
/** Existing GitHub PR review comments, fetched live. */
export function usePrComments(prId: string | null | undefined) {
  return useQuery({
    queryKey: qk.prComments(prId),
    queryFn: () => api.get<PrReviewComment[]>(`/pulls/${prId}/comments`),
    enabled: !!prId,
  });
}

export interface CreateCommentInput {
  path: string;
  line: number;
  side?: "LEFT" | "RIGHT";
  body: string;
  in_reply_to?: number;
}

/** Post one inline comment (or reply) to GitHub; refreshes the thread list. */
export function useCreatePrComment(prId: string | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateCommentInput) =>
      api.post<PrReviewComment>(`/pulls/${prId}/comments`, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.prComments(prId) }),
  });
}

// ---- Run a review (all enabled agents or a specific agent) ----
export interface RunReviewInput {
  prId: string;
  agentId?: string;
  all?: boolean;
}

export function useRunReview() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ prId, agentId, all }: RunReviewInput) =>
      api.post<ReviewRunResponse>(`/pulls/${prId}/review`, {
        ...(agentId ? { agentId } : {}),
        ...(all ? { all } : {}),
      }),
    // New runs are in flight now: refresh the live list (starts its polling),
    // the timeline and the reviews.
    onSuccess: (_d, { prId }) => {
      qc.invalidateQueries({ queryKey: qk.prActiveRuns(prId) });
      qc.invalidateQueries({ queryKey: qk.prRuns(prId) });
      qc.invalidateQueries({ queryKey: qk.reviews(prId) });
    },
  });
}

// ---- Finding actions (accept/dismiss) ----
export function useFindingAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      findingId,
      action,
      reply,
      prId: _prId,
    }: {
      findingId: string;
      action: FindingActionKind;
      reply?: string;
      prId?: string;
    }) =>
      api.post<{ finding: ReviewRecord["findings"][number]; memoryId?: string }>(
        `/findings/${findingId}/${action}`,
        reply ? { reply } : undefined,
      ),
    onSuccess: (_d, { prId }) => {
      if (prId) qc.invalidateQueries({ queryKey: qk.reviews(prId) });
    },
  });
}

/**
 * Subscribe to a run's SSE event stream. Returns the accumulated RunEvents and a
 * `running` flag (true until every stream closes). Live status for the
 * RunReviewDropdown / Live Log. Multiple runIds are subscribed in parallel.
 * Events are stored with the run-id set they belong to, so switching runs shows
 * an empty log right away without resetting state in the effect.
 */
export function useRunEvents(runIds: string[]) {
  const key = runIds.join(",");
  const [stream, setStream] = React.useState<{ key: string; events: RunEvent[]; closed: boolean }>({
    key: "",
    events: [],
    closed: true,
  });

  React.useEffect(() => {
    if (!key) return;
    const sources: EventSource[] = [];
    let open = 0;

    for (const runId of key.split(",")) {
      const es = new EventSource(runEventsUrl(runId));
      open += 1;
      // Re-subscribing to a set whose earlier streams already closed (A → A,B → A)
      // starts a fresh session: running again, with an empty log.
      es.onopen = () =>
        setStream((prev) => (prev.key === key && !prev.closed ? prev : { key, events: [], closed: false }));
      const onMsg = (ev: MessageEvent) => {
        try {
          const parsed = JSON.parse(ev.data) as RunEvent;
          setStream((prev) => ({
            key,
            events: prev.key === key ? [...prev.events, parsed] : [parsed],
            closed: false,
          }));
          // Runtime agent failures arrive as SSE `error` events (not as a
          // mutation/query error), so the global error toast never sees them —
          // surface them here so the user gets a notification without a reload.
          if (parsed.kind === "error" && parsed.msg) notify.error(parsed.msg);
        } catch {
          /* ignore non-JSON keepalive frames (and dataless native error events) */
        }
      };
      // The server tags events with kind as the SSE `event:` name AND emits them
      // as default messages too in some clients — listen broadly.
      es.onmessage = onMsg;
      for (const kind of ["info", "tool", "result", "error"]) {
        es.addEventListener(kind, onMsg as EventListener);
      }
      es.onerror = () => {
        es.close();
        open -= 1;
        if (open <= 0) {
          setStream((prev) => ({ key, events: prev.key === key ? prev.events : [], closed: true }));
        }
      };
      sources.push(es);
    }

    return () => {
      for (const es of sources) es.close();
    };
  }, [key]);

  const current = stream.key === key;
  return {
    events: current ? stream.events : [],
    running: key !== "" && !(current && stream.closed),
  };
}
