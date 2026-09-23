#!/usr/bin/env node
// Final step of pr-self-review: merge reviewer findings + hard checks + cache, apply waivers, compute the verdict.
// Usage: node finalize.mjs [--findings <path>]   (default <repo>/.omc/pr-self-review/findings.json)
// Exit: 0 = PASS / PASS WITH WARNINGS · 1 = BLOCKED · 2 = input is incomplete or stale (fix and re-run).
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import {
  SEVERITIES, SKILL_DIR, applyWaivers, collectChanges, dedupe, findingId, loadConfig, loadJson,
  pairKey, parseArgs, parseWaivers, repoRoot, safeName, stateDir, validateFinding, verdictOf,
} from './lib.mjs';

const args = parseArgs(process.argv.slice(2));
const root = repoRoot();
const dir = stateDir(root);
const config = loadConfig();

function fail(problems) {
  console.error('pr-self-review: cannot finalize —');
  for (const p of problems) console.error(`  - ${p}`);
  process.exit(2);
}

const plan = loadJson(join(dir, 'plan.json'), null);
if (!plan) fail(['no plan.json — run scripts/plan.mjs first']);
const findingsPath = typeof args.findings === 'string' ? args.findings : join(dir, 'findings.json');
const input = loadJson(findingsPath, null);
if (!input) fail([`cannot read ${findingsPath}`]);

// ---- staleness: the verdict must describe exactly the current working tree ----
const { diffHash } = collectChanges(root, plan.base);
if (diffHash !== plan.diff_hash) fail(['working tree changed since plan.mjs — re-run plan.mjs and review the new plan']);
if (input.diff_hash !== plan.diff_hash) fail([`findings.diff_hash must equal plan.diff_hash (${plan.diff_hash})`]);

// ---- completeness + validation ----
const problems = [];
const reviews = input.reviews ?? [];
const reviewed = new Map();
for (const r of reviews) {
  if (!r.skill) problems.push('a review entry has no "skill"');
  else if (r.skill !== 'repo-checks' && !plan.reviews[r.skill]) problems.push(`unknown skill "${r.skill}" — not in plan.reviews`);
  const set = reviewed.get(r.skill) ?? new Set();
  (r.files ?? []).forEach((f) => set.add(f));
  reviewed.set(r.skill, set);
  const entryFiles = new Set(r.files ?? []);
  for (const f of r.findings ?? []) {
    const errors = validateFinding(f);
    if (f.file && !entryFiles.has(f.file)) errors.push(`file is not in this entry's "files" (use the exact repo path)`);
    if (errors.length) problems.push(`${r.skill} ${f.file ?? '?'}:${f.line ?? '-'} — ${errors.join(', ')}`);
  }
}
for (const [skill, r] of Object.entries(plan.reviews)) {
  const missing = r.to_review.map((x) => x.path).filter((p) => !reviewed.get(skill)?.has(p));
  if (missing.length) problems.push(`${skill}: not reviewed — ${missing.join(', ')}`);
}
if (plan.repo_checks.files.length) {
  const missing = plan.repo_checks.files.filter((p) => !reviewed.get('repo-checks')?.has(p));
  if (missing.length) problems.push(`repo-checks: not reviewed — ${missing.length} file(s), e.g. ${missing.slice(0, 3).join(', ')}`);
}
const hardVerifications = input.hard_verifications ?? {};
for (const f of plan.hard_findings) {
  if (f.needs_verification && !['confirmed', 'rejected'].includes(hardVerifications[f.id])) {
    problems.push(`hard finding ${f.id} (${f.rule} ${f.file}:${f.line}) needs hard_verifications["${f.id}"] = confirmed | rejected`);
  }
}
for (const c of input.checks ?? []) {
  if (!['lint', 'typecheck', 'test'].includes(c.kind) || !['pass', 'fail'].includes(c.status) || !c.package) {
    problems.push(`bad checks entry ${JSON.stringify(c)} — want { package, kind: lint|typecheck|test, status: pass|fail }`);
  }
}
if (problems.length) fail(problems);

// ---- collect ----
const all = [];
for (const f of plan.hard_findings) {
  if (hardVerifications[f.id] === 'rejected') continue;
  all.push({ ...f });
}
// A skill may be split into several chunk entries: gather its findings across all of them first.
const keptBySkill = new Map();
for (const r of reviews) {
  const kept = keptBySkill.get(r.skill) ?? [];
  for (const f of r.findings ?? []) {
    if (f.verification === 'rejected') continue;
    const severity = f.verification === 'downgraded' ? f.verified_severity : f.severity;
    const finding = { ...f, severity, skill: r.skill, source: r.skill === 'repo-checks' ? 'repo-checks' : 'skill' };
    finding.id = findingId(finding);
    kept.push(finding);
  }
  keptBySkill.set(r.skill, kept);
}
const newCache = loadJson(join(dir, 'cache.json'), { entries: {} });
for (const [skill, kept] of keptBySkill) {
  all.push(...kept);
  const planned = plan.reviews[skill];
  if (!planned) continue; // repo-checks is never cached
  for (const item of planned.to_review) {
    newCache.entries[pairKey(skill, item.path)] = {
      key: item.cache_key,
      findings: kept.filter((f) => f.file === item.path),
      reviewed_at: new Date().toISOString(),
    };
  }
}
for (const [skill, r] of Object.entries(plan.reviews)) {
  for (const c of r.cached) all.push(...c.findings.map((f) => ({ ...f, skill, cached: true })));
}
for (const c of input.checks ?? []) {
  if (c.status !== 'fail') continue;
  const f = {
    source: 'checks', skill: 'checks', rule: `checks#${c.kind}`, severity: 'critical', file: c.package, line: null,
    message: `${c.command ?? c.kind} failed in ${c.package}${c.summary ? `: ${c.summary}` : ''}`,
    fix: 'Fix the failures and re-run the review.',
  };
  f.id = findingId(f);
  all.push(f);
}

// ---- waivers (per original finding), then dedupe only what still counts ----
const waiversPath = join(SKILL_DIR, 'waivers.md');
const waivers = existsSync(waiversPath) ? parseWaivers(readFileSync(waiversPath, 'utf8')) : [];
const waiverProblems = applyWaivers(all, waivers, config);
const findings = [
  ...dedupe(all.filter((f) => !f.waived)),
  ...all.filter((f) => f.waived).map((f) => ({ ...f, sources: [f.skill], also: [] })),
];
const { verdict, counts } = verdictOf(findings);
const allowed = verdict !== 'BLOCKED';

// ---- report ----
const loc = (f) => `\`${f.file}${f.line ? `:${f.line}` : ''}\``;
const md = [];
md.push(`# PR self-review — ${plan.branch}`);
md.push('');
md.push(`**Verdict: ${verdict}** · critical ${counts.critical} · major ${counts.major} · minor ${counts.minor} · nit ${counts.nit}`);
md.push('');
md.push(`Base \`${plan.base_ref}\` · merge-base \`${plan.merge_base.slice(0, 7)}\` · diff-hash \`${plan.diff_hash.slice(0, 12)}\` · ${new Date().toISOString()}`);
for (const sev of SEVERITIES) {
  const list = findings.filter((f) => f.severity === sev && !f.waived);
  if (!list.length) continue;
  md.push('');
  md.push(`## ${sev[0].toUpperCase() + sev.slice(1)}${sev === 'critical' ? ' (blocking)' : ''}`);
  for (const f of list) {
    md.push(`- ${loc(f)} · \`${f.rule}\` · ${f.sources.join(', ')}${f.cached ? ' · cached' : ''} — ${f.message}`);
    if (f.quote) md.push(`  > \`${String(f.quote).replace(/`/g, "'")}\``);
    if (f.fix) md.push(`  Fix: ${f.fix}`);
    for (const a of f.also) md.push(`  Also: [${a.severity}] \`${a.rule}\` (${a.skill}) — ${a.message}`);
  }
}
const waived = findings.filter((f) => f.waived);
if (waived.length) {
  md.push('');
  md.push('## Waived');
  for (const f of waived) {
    md.push(`- [${f.severity}] ${loc(f)} · \`${f.rule}\` — ${f.waived.reason} (by ${f.waived.author || '?'}, until ${f.waived.expires ?? '—'})`);
  }
}
md.push('');
md.push('## Coverage');
md.push('| Skill | Reviewed | From cache |');
md.push('|---|---|---|');
for (const [skill, r] of Object.entries(plan.reviews)) md.push(`| ${skill} | ${r.to_review.length} | ${r.cached.length} |`);
md.push(`| repo-checks | ${plan.repo_checks.files.length} | — |`);
md.push(`| hard checks | all changed files | — |`);
if (input.checks?.length) {
  md.push('');
  md.push('## Checks');
  for (const c of input.checks) md.push(`- ${c.package} · ${c.kind}: **${c.status}**${c.summary ? ` — ${c.summary}` : ''}`);
}
const warnings = [
  ...plan.unmapped_skills.map((s) => `Unmapped skill \`${s}\` — not run; add it to config.json.`),
  ...plan.missing_skills.map((s) => `Skill \`${s}\` is in config.json but not installed.`),
  ...waiverProblems,
];
if (plan.files.deleted.length) warnings.push(`Deleted files (not reviewed; check their importers): ${plan.files.deleted.join(', ')}`);
if (warnings.length) {
  md.push('');
  md.push('## Warnings');
  for (const w of warnings) md.push(`- ${w}`);
}
md.push('');
md.push(allowed ? 'PR creation: ALLOWED' : `PR creation: FORBIDDEN (${counts.critical} critical)`);

const reportPath = join(dir, `${safeName(plan.branch)}-${plan.diff_hash.slice(0, 12)}.md`);
writeFileSync(reportPath, md.join('\n') + '\n');
writeFileSync(join(dir, 'cache.json'), JSON.stringify(newCache, null, 2));
writeFileSync(join(dir, 'last-verdict.json'), JSON.stringify({
  branch: plan.branch,
  base: plan.base,
  merge_base: plan.merge_base,
  diff_hash: plan.diff_hash,
  verdict,
  counts,
  report: relative(root, reportPath),
  created_at: new Date().toISOString(),
}, null, 2));

console.log(md.join('\n'));
console.log(`\nReport: ${relative(root, reportPath)}`);
process.exit(allowed ? 0 : 1);
