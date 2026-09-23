# Examples

## Contents
- 1. Growing a screen: file trees
- 2. Extracting business logic from a component
- 3. Constants: where and how
- 4. Promoting and demoting code
- 5. Fixing a sideways import

## 1. Growing a screen: file trees

**Start: one consumer, everything colocated**
```
app/agents/
  page.tsx                         # renders <AgentsListView/>
  _components/
    AgentsListView/
      AgentsListView.tsx
      AgentsListView.test.tsx
      index.ts
```

**Grows: extract pure logic and a child before splitting further**
```
app/agents/_components/AgentsListView/
  AgentsListView.tsx
  AgentsListView.test.tsx
  index.ts
  helpers.ts                       # sortAgents, filterByQuery
  constants.ts                     # SORT_KEYS
  styles.ts
  _components/
    CreateAgentModal/              # used only by AgentsListView
```

**Bad: technical top-level folders, far from their only consumer**
```
src/
  components/AgentsListView.tsx
  components/CreateAgentModal.tsx   # used by one screen, but "shared"
  utils/index.ts                    # sortAgents + formatDate + slugify + ...
  constants/index.ts                # SORT_KEYS + API_BASE + COLORS
```

## 2. Extracting business logic from a component

**Before: rules, fetching and view mixed**
```tsx
export function FindingsPanel({ runId }: Props) {
  const [findings, setFindings] = useState<Finding[]>([]);
  const [hideLow, setHideLow] = useState(true);
  useEffect(() => {
    fetch(`${API}/runs/${runId}/findings`).then((r) => r.json()).then(setFindings);
  }, [runId]);
  const shown = findings
    .filter((f) => !hideLow || f.confidence >= 0.65)
    .sort((a, b) => ({ CRITICAL: 0, WARNING: 1 }[a.severity] ?? 9) - ({ CRITICAL: 0, WARNING: 1 }[b.severity] ?? 9));
  return <List items={shown} />;
}
```

**After: each concern in its layer**
```ts
// constants.ts
/** Sort weight per severity (lower = shown first). */
export const SEVERITY_ORDER: Record<Severity, number> = { CRITICAL: 0, WARNING: 1, SUGGESTION: 2, INFO: 3 };
/** Confidence below this is hidden when "hide low confidence" is on. */
export const LOW_CONFIDENCE_THRESHOLD = 0.65;

// helpers.ts: pure, unit-tested without React
export function visibleFindings(findings: Finding[], hideLow: boolean): Finding[] {
  const shown = hideLow ? findings.filter((f) => f.confidence >= LOW_CONFIDENCE_THRESHOLD) : findings;
  return [...shown].sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
}

// lib/hooks/reviews.ts: server state through the single API client
export function useRunFindings(runId: string) {
  return useQuery({ queryKey: ["findings", runId], queryFn: () => api.get<Finding[]>(`/runs/${runId}/findings`), enabled: !!runId });
}
```
```tsx
// FindingsPanel.tsx: view + wiring only
export function FindingsPanel({ runId }: Props) {
  const { data = [] } = useRunFindings(runId);
  const [hideLow, setHideLow] = useState(true);
  const shown = visibleFindings(data, hideLow); // derived during render, no effect
  return <List items={shown} />;
}
```

## 3. Constants: where and how

```ts
// ✅ component constants.ts: typed, named, reason given
/** Poll while a run is in flight; matches server heartbeat. */
export const RUN_POLL_MS = 4000;
export const COLUMN_KEYS = ["title", "author", "status", "cost"] as const;
export type ColumnKey = (typeof COLUMN_KEYS)[number];

// ❌ user-visible text as a constant: use i18n instead
export const EMPTY_TITLE = "No findings yet";

// ❌ env read scattered across components: read once in the API/config module
const base = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:3001";
```

## 4. Promoting and demoting code

`formatCost` starts in `PRRow/helpers.ts`. The run timeline needs it too, so:
1. Move it to `lib/format-cost.ts` (named for what it does) with its test.
2. If both places render it the same way, extract `components/run-cost-badge/`.
3. Update both imports and delete the old helper. Don't keep a re-export.

Demote in reverse: a `components/<kebab>/` item that ends up with one consumer moves back into that consumer's `_components/`.

## 5. Fixing a sideways import

```ts
// ❌ app/agents/_components/AgentCard/AgentCard.tsx
import { SeverityPill } from "@/app/repos/[repoId]/pulls/[number]/_components/SeverityFilterPills";
```
Fix options, in order:
1. **Promote**: move the piece both need to `components/<kebab>/` and import it from there in both.
2. **Compose in the route**: the route renders both features and passes data or slots (`children`) between them.
3. **Duplicate** if the two usages are likely to diverge. Prefer that over a shared component full of flags.
