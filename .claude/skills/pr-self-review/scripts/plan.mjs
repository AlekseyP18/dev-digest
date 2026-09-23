#!/usr/bin/env node
// Step 1 of pr-self-review: collect local changes, run hard checks, route files to skills, look up the cache.
// Usage: node plan.mjs [--base main] [--no-cache]
// Writes <repo>/.omc/pr-self-review/plan.json and prints a summary.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  cacheEntryKey, collectChanges, configHash, currentBranch, dirHash, discoverSkills, hardChecks, loadConfig,
  loadJson, matchesAny, pairKey, parseArgs, readAtCommit, repoRoot, routeFiles, stateDir,
} from './lib.mjs';

const args = parseArgs(process.argv.slice(2));
const config = loadConfig();
const root = repoRoot();
const base = typeof args.base === 'string' ? args.base : config.defaultBase;
const useCache = !args['no-cache'];

const { baseRef, mergeBase, diffHash, files } = collectChanges(root, base);
const skillsDir = join(root, '.claude', 'skills');
const installed = discoverSkills(skillsDir);
const route = routeFiles(files, config, installed);

const readNow = (p) => (existsSync(join(root, p)) ? readFileSync(join(root, p), 'utf8') : null);
const readBase = (p) => readAtCommit(root, mergeBase, p);
const hardFindings = hardChecks(files, { readNow, readBase });

const dir = stateDir(root);
mkdirSync(dir, { recursive: true });
const cache = useCache ? loadJson(join(dir, 'cache.json'), { entries: {} }) : { entries: {} };
const cfgHash = configHash();
const byPath = Object.fromEntries(files.map((f) => [f.path, f]));

const reviews = {};
for (const [skill, routed] of Object.entries(route.routing)) {
  const skillMd = join('.claude', 'skills', skill, 'SKILL.md');
  const skillHash = dirHash(join(skillsDir, skill));
  const toReview = [];
  const cached = [];
  for (const { path, reason } of routed) {
    const key = cacheEntryKey({ contentHash: byPath[path].contentHash, skillHash, configHash: cfgHash, mergeBase });
    const hit = cache.entries[pairKey(skill, path)];
    if (hit && hit.key === key) cached.push({ path, cache_key: key, findings: hit.findings });
    else toReview.push({ path, reason, cache_key: key });
  }
  reviews[skill] = { skill_md: skillMd, to_review: toReview, cached };
}

const last = loadJson(join(dir, 'last-verdict.json'), null);
const existingReport =
  last && last.diff_hash === diffHash && existsSync(join(root, last.report)) ? last : null;

const plan = {
  generated_at: new Date().toISOString(),
  branch: currentBranch(root),
  base,
  base_ref: baseRef,
  merge_base: mergeBase,
  diff_hash: diffHash,
  existing_report: existingReport && { report: existingReport.report, verdict: existingReport.verdict },
  diff_command: `git diff ${mergeBase} -- <file>`,
  untracked: files.filter((f) => f.untracked).map((f) => f.path),
  files: { reviewable: route.reviewable, excluded: route.excluded, deleted: route.deleted },
  hard_findings: hardFindings,
  reviews,
  repo_checks: { files: route.reviewable.filter((p) => matchesAny(p, config.repoChecksFiles)) },
  unmapped_skills: route.unmappedSkills,
  missing_skills: route.missingSkills,
};
writeFileSync(join(dir, 'plan.json'), JSON.stringify(plan, null, 2));

// ---- summary ----
const lines = [];
lines.push(`pr-self-review plan · ${plan.branch} vs ${baseRef} (merge-base ${mergeBase.slice(0, 7)})`);
lines.push(`diff-hash ${diffHash.slice(0, 12)} · reviewable ${route.reviewable.length} · excluded ${route.excluded.length} · deleted ${route.deleted.length}`);
if (existingReport) lines.push(`EXISTING REPORT for this exact diff: ${existingReport.report} (${existingReport.verdict})`);
if (!route.reviewable.length && !hardFindings.length) lines.push('No reviewable changes.');
lines.push('');
lines.push('Skills:');
for (const [skill, r] of Object.entries(reviews)) {
  lines.push(`  ${skill.padEnd(26)} review ${String(r.to_review.length).padStart(3)} · cached ${r.cached.length}`);
}
lines.push(`  ${'repo-checks'.padEnd(26)} review ${String(plan.repo_checks.files.length).padStart(3)} · never cached`);
if (hardFindings.length) {
  lines.push('');
  lines.push('Hard findings:');
  for (const f of hardFindings) {
    lines.push(`  [${f.severity}] ${f.rule} ${f.file}${f.line ? `:${f.line}` : ''}${f.needs_verification ? ' (needs verification)' : ''}`);
  }
}
if (route.unmappedSkills.length) lines.push(`\nUNMAPPED skills (add to config.json): ${route.unmappedSkills.join(', ')}`);
if (route.missingSkills.length) lines.push(`Skills in config.json but not installed: ${route.missingSkills.join(', ')}`);
lines.push(`\nPlan: ${join(dir, 'plan.json')}`);
console.log(lines.join('\n'));
