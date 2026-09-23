/* keys.ts — every TanStack Query key in the app. Hooks and invalidations use
   these builders so a key is spelled once; nothing outside lib/hooks builds keys. */

type Id = string | number | null | undefined;

export const qk = {
  settings: () => ["settings"] as const,
  secretsStatus: () => ["secrets-status"] as const,
  providerModels: (provider?: string | null) =>
    provider === undefined ? (["provider-models"] as const) : (["provider-models", provider] as const),

  repos: () => ["repos"] as const,
  pulls: (repoId: Id) => ["pulls", repoId] as const,
  pull: (prId: Id) => ["pull", prId] as const,
  context: (repoId: Id) => ["context", repoId] as const,
  repoIntelState: (repoId: Id) => ["repo-intel-state", repoId] as const,

  agents: () => ["agents"] as const,
  agent: (id: Id) => ["agent", id] as const,

  reviews: (prId: Id) => ["reviews", prId] as const,
  prRuns: (prId: Id) => ["pr-runs", prId] as const,
  prActiveRuns: (prId: Id) => ["pr-active-runs", prId] as const,
  prComments: (prId: Id) => ["pr-comments", prId] as const,
  runTrace: (runId: Id) => ["run-trace", runId] as const,
};
