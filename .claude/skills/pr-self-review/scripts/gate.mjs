#!/usr/bin/env node
// Gate before `gh pr create` / `gh pr merge`: is there a non-BLOCKED verdict for exactly the current diff?
// Usage: node gate.mjs [--base main]
// Exit 0 + "PR creation: ALLOWED" · exit 1 + "PR creation: FORBIDDEN — <reason>".
import { join } from 'node:path';
import {
  collectChanges, currentBranch, loadConfig, loadJson, parseArgs, repoRoot, stateDir, uncommittedPaths,
} from './lib.mjs';

const args = parseArgs(process.argv.slice(2));
const root = repoRoot();
const last = loadJson(join(stateDir(root), 'last-verdict.json'), null);
const base = typeof args.base === 'string' ? args.base : last?.base ?? loadConfig().defaultBase;

function forbid(reason) {
  console.log(`PR creation: FORBIDDEN — ${reason}`);
  process.exit(1);
}

if (!last) forbid('no pr-self-review verdict yet. Run the pr-self-review skill.');
// The PR ships HEAD. With uncommitted edits the reviewed tree ≠ what gets pushed.
const dirty = uncommittedPaths(root, loadConfig());
if (dirty.length) {
  forbid(`uncommitted changes (${dirty.slice(0, 5).join(', ')}${dirty.length > 5 ? ', …' : ''}). Commit or stash them, then re-run pr-self-review so the review covers exactly what the PR ships.`);
}
const branch = currentBranch(root);
if (last.branch !== branch) forbid(`last verdict is for branch "${last.branch}", current is "${branch}". Re-run pr-self-review.`);
const { diffHash } = collectChanges(root, base);
if (last.diff_hash !== diffHash) forbid('changes since the last review (diff-hash differs). Re-run pr-self-review.');
if (last.verdict === 'BLOCKED') forbid(`${last.counts.critical} critical finding(s) — see ${last.report}`);

console.log(`PR creation: ALLOWED (${last.verdict}, ${last.report})`);
