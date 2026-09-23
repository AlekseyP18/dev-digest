// Run: node --test .claude/skills/pr-self-review/scripts/lib.test.mjs
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { after, describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  applyWaivers, dedupe, globToRegExp, hardChecks, loadConfig, parseAddedLines, parseNameStatus,
  parseWaivers, routeFiles, treeDeltaHash, unquotePath, validateFinding, verdictOf,
} from './lib.mjs';

const config = loadConfig();
const file = (path, status = 'M', added = []) => ({
  path, status, added: added.map((text, i) => ({ line: i + 1, text })),
});
// Built by concatenation so this file does not trip its own hard checks when it is in a diff.
const FAKE_GH_TOKEN = 'gh' + 'p_' + 'A1b2C3d4'.repeat(5);
const FOCUSED_LINE = 'it' + ".only('x', () => {})";
const PG_IMPORT_LINE = "import { x } from '../test/helpers/" + "pg.js';";

describe('globToRegExp', () => {
  test('** spans directories, * does not', () => {
    assert.ok(globToRegExp('client/src/**/*.tsx').test('client/src/app/a/B.tsx'));
    assert.ok(globToRegExp('client/src/**/*.tsx').test('client/src/B.tsx'));
    assert.ok(!globToRegExp('server/*.ts').test('server/src/a.ts'));
    assert.ok(globToRegExp('**/*.{ts,tsx}').test('a/b.tsx'));
    assert.ok(!globToRegExp('**/*.{ts,tsx}').test('a/b.json'));
    assert.ok(globToRegExp('a/{b.ts').test('a/{b.ts'), 'unclosed brace is literal, no hang');
  });
});

describe('git output parsers', () => {
  test('name-status with rename', () => {
    const raw = ['M', 'a.ts', 'R100', 'old.ts', 'new.ts', 'D', 'gone.ts', ''].join('\0');
    assert.deepEqual(parseNameStatus(raw), [
      { path: 'a.ts', status: 'M' },
      { path: 'new.ts', oldPath: 'old.ts', status: 'R' },
      { path: 'gone.ts', status: 'D' },
    ]);
  });
  test('added lines keep new-file line numbers', () => {
    const raw = ['diff --git a/x.ts b/x.ts', '--- a/x.ts', '+++ b/x.ts', '@@ -3,0 +4,2 @@', '+one', '+two', '@@ -9 +11 @@', '-old', '+new'].join('\n');
    assert.deepEqual(parseAddedLines(raw)['x.ts'], [
      { line: 4, text: 'one' }, { line: 5, text: 'two' }, { line: 11, text: 'new' },
    ]);
  });
  test('paths with spaces (trailing TAB) and C-quoted paths', () => {
    const raw = ['+++ b/a b.ts\t', '@@ -0,0 +1 @@', '+x', '+++ "b/q\\"uote\\303\\251.ts"', '@@ -0,0 +1 @@', '+y'].join('\n');
    const parsed = parseAddedLines(raw);
    assert.deepEqual(parsed['a b.ts'], [{ line: 1, text: 'x' }]);
    assert.deepEqual(parsed['q"uote\u00e9.ts'], [{ line: 1, text: 'y' }]);
  });
});

describe('treeDeltaHash', () => {
  test('rename == add + delete; content change breaks it; base is part of it', () => {
    const renamed = [{ path: 'new.ts', oldPath: 'old.ts', status: 'R', contentHash: 'c1' }];
    const split = [{ path: 'new.ts', status: 'A', untracked: true, contentHash: 'c1' }, { path: 'old.ts', status: 'D', contentHash: 'deleted' }];
    assert.equal(treeDeltaHash('m', renamed), treeDeltaHash('m', split));
    assert.notEqual(treeDeltaHash('m', renamed), treeDeltaHash('m', [{ ...renamed[0], contentHash: 'c2' }]));
    assert.notEqual(treeDeltaHash('m', renamed), treeDeltaHash('other', renamed));
  });
  test('unquotePath leaves plain paths alone', () => {
    assert.equal(unquotePath('b/plain.ts'), 'b/plain.ts');
  });
});

describe('routeFiles', () => {
  const installed = [...Object.keys(config.skills), 'engineering-insights', 'mermaid-diagram', 'pr-self-review'];
  const skillsFor = (r, path) => Object.entries(r.routing).filter(([, fs]) => fs.some((f) => f.path === path)).map(([s]) => s).sort();

  test('UI file goes only to UI skills', () => {
    const r = routeFiles([file('client/src/app/agents/_components/AgentCard/AgentCard.tsx', 'M', ['const [a] = useState(0);'])], config, installed);
    const skills = skillsFor(r, 'client/src/app/agents/_components/AgentCard/AgentCard.tsx');
    assert.deepEqual(skills, ['next-best-practices', 'react-best-practices']);
  });

  test('backend service goes to architecture + content-matched skills, never UI skills', () => {
    const r = routeFiles([file('server/src/modules/pulls/service.ts', 'M', ["import { eq } from 'drizzle-orm';"])], config, installed);
    const skills = skillsFor(r, 'server/src/modules/pulls/service.ts');
    assert.ok(skills.includes('onion-architecture'));
    assert.ok(skills.includes('drizzle-orm-patterns'));
    assert.ok(skills.includes('security'));
    assert.ok(!skills.some((s) => s.startsWith('react') || s.startsWith('next') || s.startsWith('frontend')));
  });

  test('frontend-ui-architecture only for new/moved client files', () => {
    const added = routeFiles([file('client/src/components/x/X.tsx', 'A')], config, installed);
    const modified = routeFiles([file('client/src/components/x/X.tsx', 'M')], config, installed);
    assert.ok(skillsFor(added, 'client/src/components/x/X.tsx').includes('frontend-ui-architecture'));
    assert.ok(!skillsFor(modified, 'client/src/components/x/X.tsx').includes('frontend-ui-architecture'));
  });

  test('postgresql-table-design sees new migrations, not edits of old ones', () => {
    const r = routeFiles([
      file('server/src/db/migrations/0009_new.sql', 'A'),
      file('server/src/db/migrations/0001_old.sql', 'M'),
    ], config, installed);
    assert.deepEqual(r.routing['postgresql-table-design'].map((f) => f.path), ['server/src/db/migrations/0009_new.sql']);
  });

  test('excluded, deleted, unmapped and missing skills are reported', () => {
    const r = routeFiles([
      file('client/pnpm-lock.yaml'), file('server/src/a.ts', 'D'), file('.claude/worktrees/x/a.ts', 'A'),
    ], config, ['react-best-practices', 'tailwind-rules', 'mermaid-diagram']);
    assert.deepEqual(r.excluded, ['client/pnpm-lock.yaml', '.claude/worktrees/x/a.ts']);
    assert.deepEqual(r.deleted, ['server/src/a.ts']);
    assert.deepEqual(r.unmappedSkills, ['tailwind-rules']);
    assert.ok(r.missingSkills.includes('onion-architecture'));
  });
});

describe('hardChecks', () => {
  const io = (now = {}, base = {}) => ({ readNow: (p) => now[p] ?? null, readBase: (p) => base[p] ?? null });
  const rules = (fs, i = io()) => hardChecks(fs, i).map((f) => `${f.rule}:${f.severity}`);

  test('edited migration is critical, new migration is fine', () => {
    assert.deepEqual(rules([file('server/src/db/migrations/0003_x.sql', 'M')]), ['hard#migration-edited:critical']);
    assert.deepEqual(rules([file('server/src/db/migrations/0009_x.sql', 'A')]), []);
    assert.deepEqual(rules([file('server/src/db/migrations/meta/_journal.json', 'M')]), []);
  });

  test('lockfile without its package.json', () => {
    assert.deepEqual(rules([file('client/pnpm-lock.yaml')]), ['hard#lockfile-without-manifest:major']);
    assert.deepEqual(rules([file('client/pnpm-lock.yaml'), file('client/package.json')]), []);
  });

  test('.only / .skip in tests, pg helper naming', () => {
    assert.deepEqual(rules([file('server/test/a.test.ts', 'M', [FOCUSED_LINE])]), ['hard#focused-test:critical']);
    assert.deepEqual(rules([file('server/src/a.ts', 'M', [FOCUSED_LINE])]), []);
    assert.deepEqual(
      rules([file('server/test/a.test.ts', 'A', ["import { startPg } from './helpers/pg';", PG_IMPORT_LINE])]),
      ['hard#it-test-naming:major'],
    );
  });

  test('secrets need verification', () => {
    const [f] = hardChecks([file('server/src/a.ts', 'M', [`const t = '${FAKE_GH_TOKEN}';`])], io());
    assert.equal(f.rule, 'hard#secret-in-code');
    assert.equal(f.needs_verification, true);
    assert.equal(hardChecks([file('server/src/a.ts', 'M', ['const token = getToken();'])], io()).length, 0);
  });

  test('shared contract drift only when this diff caused it', () => {
    const s = 'server/src/vendor/shared/contracts/x.ts';
    const c = 'client/src/vendor/shared/contracts/x.ts';
    assert.deepEqual(rules([file(s)], io({ [s]: 'new', [c]: 'old' }, { [s]: 'old', [c]: 'old' })), ['hard#shared-contract-drift:critical']);
    assert.deepEqual(rules([file(s), file(c)], io({ [s]: 'new', [c]: 'new' }, { [s]: 'old', [c]: 'old' })), []);
    assert.deepEqual(rules([file(s)], io({ [s]: 'new', [c]: 'other' }, { [s]: 'a', [c]: 'b' })), []);
    assert.deepEqual(rules([file(s, 'A')], io({ [s]: 'new' })), ['hard#shared-contract-drift:major']);
  });
});

describe('waivers', () => {
  const md = [
    '| file | rule | severity | reason | expires | author |',
    '|---|---|---|---|---|---|',
    '| `client/a.tsx` | repo-checks#i18n | major | brand name | | alex |',
    '| server/** | hard#focused-test | critical | flaky upstream | 2026-10-01 | alex |',
    '| server/x.ts | hard#focused-test | critical | too long | 2027-12-01 | alex |',
    '| server/y.ts | repo-checks#naming | minor |  | | alex |',
    '| server/db.sql | hard#migration-edited | critical | typo | 2026-10-01 | alex |',
  ].join('\n');
  const today = new Date('2026-09-23T12:00:00Z');
  const waivers = parseWaivers(md);
  const f = (file, rule, severity) => ({ file, rule, severity });

  test('parse skips header and separator, strips backticks', () => {
    assert.equal(waivers.length, 5);
    assert.equal(waivers[0].file, 'client/a.tsx');
  });

  test('valid, too long, missing reason, non-waivable', () => {
    const findings = [
      f('client/a.tsx', 'repo-checks#i18n', 'major'),
      f('server/t.test.ts', 'hard#focused-test', 'critical'),
      f('server/y.ts', 'repo-checks#naming', 'minor'),
      f('server/db.sql', 'hard#migration-edited', 'critical'),
    ];
    const problems = applyWaivers(findings, waivers, config, today);
    assert.ok(findings[0].waived);
    assert.ok(findings[1].waived);
    assert.ok(!findings[2].waived);
    assert.ok(!findings[3].waived);
    assert.equal(problems.length, 2);

    const tooLong = [f('server/x.ts', 'hard#focused-test', 'critical')];
    applyWaivers(tooLong, waivers.slice(2), config, today);
    assert.ok(!tooLong[0].waived);

    const bad = parseWaivers('| a.ts | r#x | critical | why | 2026-13-01 | me |\n| a.ts | r#y | minor | a | b | c | d |');
    const impossible = [f('a.ts', 'r#x', 'critical')];
    const badProblems = applyWaivers(impossible, bad, config, today);
    assert.ok(!impossible[0].waived, 'impossible date never waives');
    assert.ok(badProblems.some((p) => p.includes('invalid date')));
    assert.ok(badProblems.some((p) => p.includes('malformed')));

    const expired = [f('server/t.test.ts', 'hard#focused-test', 'critical')];
    applyWaivers(expired, waivers, config, new Date('2026-10-05T00:00:00Z'));
    assert.ok(!expired[0].waived);
  });
});

describe('findings', () => {
  test('dedupe keeps worst severity and all sources', () => {
    const out = dedupe([
      { file: 'a.ts', line: 3, severity: 'minor', skill: 'zod', rule: 'zod#x', message: 'm1' },
      { file: 'a.ts', line: 3, severity: 'critical', skill: 'security', rule: 'security#y', message: 'm2' },
      { file: 'a.ts', line: 4, severity: 'nit', skill: 'zod', rule: 'zod#z', message: 'm3' },
    ]);
    assert.equal(out.length, 2);
    assert.equal(out[0].severity, 'critical');
    assert.deepEqual(out[0].sources, ['zod', 'security']);
    assert.equal(out[0].also[0].rule, 'zod#x');
  });

  test('verdict ignores waived findings', () => {
    assert.equal(verdictOf([]).verdict, 'PASS');
    assert.equal(verdictOf([{ severity: 'minor' }]).verdict, 'PASS WITH WARNINGS');
    assert.equal(verdictOf([{ severity: 'critical' }]).verdict, 'BLOCKED');
    assert.equal(verdictOf([{ severity: 'critical', waived: {} }]).verdict, 'PASS');
  });

  test('critical requires verification', () => {
    const base = { file: 'a.ts', line: 1, rule: 'r#x', message: 'm' };
    assert.ok(validateFinding({ ...base, severity: 'critical' }).length > 0);
    assert.deepEqual(validateFinding({ ...base, severity: 'critical', verification: 'confirmed' }), []);
    assert.ok(validateFinding({ ...base, severity: 'critical', verification: 'downgraded' }).length > 0);
    assert.ok(validateFinding({ ...base, severity: 'huge' }).length > 0);
  });
});

// ---------- end-to-end on a throwaway repo ----------

describe('plan → finalize → gate (temp git repo)', () => {
  const scripts = dirname(fileURLToPath(import.meta.url));
  const repo = mkdtempSync(join(tmpdir(), 'pr-self-review-'));
  after(() => rmSync(repo, { recursive: true, force: true }));
  const sh = (...args) => execFileSync('git', args, { cwd: repo, encoding: 'utf8' });
  const run = (script, ...args) => spawnSync('node', [join(scripts, script), ...args], { cwd: repo, encoding: 'utf8' });
  const write = (p, c) => {
    mkdirSync(dirname(join(repo, p)), { recursive: true });
    writeFileSync(join(repo, p), c);
  };
  const state = (p) => join(repo, '.omc', 'pr-self-review', p);
  const readJson = (p) => JSON.parse(readFileSync(state(p), 'utf8'));

  sh('init', '-q', '-b', 'main');
  sh('config', 'user.email', 't@t');
  sh('config', 'user.name', 't');
  write('.gitignore', '.omc/\n');
  write('.claude/skills/react-best-practices/SKILL.md', '# react\n');
  write('.claude/skills/onion-architecture/SKILL.md', '# onion\n');
  write('server/src/db/migrations/0001_a.sql', 'create table a();\n');
  write('client/src/app/page.tsx', 'export default function P() { return null; }\n');
  sh('add', '.');
  sh('commit', '-qm', 'init');
  sh('checkout', '-qb', 'feature');

  const findingsFor = (plan, extra = {}) => ({
    diff_hash: plan.diff_hash,
    reviews: [
      ...Object.entries(plan.reviews).map(([skill, r]) => ({ skill, files: r.to_review.map((x) => x.path), findings: [] })),
      { skill: 'repo-checks', files: plan.repo_checks.files, findings: [] },
    ],
    ...extra,
  });

  test('clean UI change → PASS → gate ALLOWED; edit → gate FORBIDDEN; unchanged file cached', () => {
    write('client/src/app/page.tsx', "import { useState } from 'react';\nexport default function P() { const [a] = useState(0); return a; }\n");
    write('client/src/app/other.tsx', 'export const O = 1;\n');
    assert.equal(run('plan.mjs').status, 0);
    const plan = readJson('plan.json');
    assert.deepEqual(Object.keys(plan.reviews), ['react-best-practices']);
    assert.equal(plan.reviews['react-best-practices'].to_review.length, 2);

    assert.equal(run('finalize.mjs').status, 2, 'no findings.json yet');
    writeFileSync(state('findings.json'), JSON.stringify(findingsFor(plan)));
    const fin = run('finalize.mjs');
    assert.equal(fin.status, 0, fin.stderr);
    assert.match(fin.stdout, /Verdict: PASS\*\*/);
    assert.match(run('gate.mjs').stdout, /FORBIDDEN — uncommitted changes/, 'PR ships HEAD, not the working tree');
    sh('add', '.');
    sh('commit', '-qm', 'ui');
    assert.match(run('gate.mjs').stdout, /ALLOWED/, 'same diff once committed → verdict still valid');

    write('client/src/app/other.tsx', 'export const O = 2;\n');
    assert.equal(run('gate.mjs').status, 1);
    assert.equal(run('finalize.mjs').status, 2, 'stale plan is rejected');
    run('plan.mjs');
    const plan2 = readJson('plan.json');
    assert.deepEqual(plan2.reviews['react-best-practices'].cached.map((c) => c.path), ['client/src/app/page.tsx']);
    assert.deepEqual(plan2.reviews['react-best-practices'].to_review.map((c) => c.path), ['client/src/app/other.tsx']);
  });

  test('edited migration + unverified critical → exit 2, then BLOCKED and gate FORBIDDEN', () => {
    write('server/src/db/migrations/0001_a.sql', 'create table b();\n');
    run('plan.mjs');
    const plan = readJson('plan.json');
    assert.ok(plan.hard_findings.some((f) => f.rule === 'hard#migration-edited'));

    const crit = { file: 'client/src/app/other.tsx', line: 1, severity: 'critical', rule: 'react-best-practices#x', message: 'm' };
    const withCrit = findingsFor(plan);
    withCrit.reviews[0].findings.push(crit);
    writeFileSync(state('findings.json'), JSON.stringify(withCrit));
    const unverified = run('finalize.mjs');
    assert.equal(unverified.status, 2);
    assert.match(unverified.stderr, /needs verification/);

    crit.verification = 'rejected';
    writeFileSync(state('findings.json'), JSON.stringify(withCrit));
    const fin = run('finalize.mjs');
    assert.equal(fin.status, 1);
    assert.match(fin.stdout, /PR creation: FORBIDDEN \(1 critical\)/);
    sh('add', '.');
    sh('commit', '-qm', 'migration');
    assert.match(run('gate.mjs').stdout, /FORBIDDEN — 1 critical/);
  });

  test('chunked reviews keep every chunk\'s findings in the cache; findings must name a file of their entry', () => {
    write('client/src/app/a.tsx', 'export const A = 1;\n');
    write('client/src/app/b.tsx', 'export const B = 1;\n');
    run('plan.mjs');
    const plan = readJson('plan.json');
    const files = plan.reviews['react-best-practices'].to_review.map((x) => x.path);
    assert.deepEqual(files, ['client/src/app/a.tsx', 'client/src/app/b.tsx']);
    const crit = { file: 'client/src/app/a.tsx', line: 1, severity: 'critical', rule: 'react-best-practices#x', message: 'm', verification: 'confirmed' };
    const input = {
      diff_hash: plan.diff_hash,
      reviews: [
        { skill: 'react-best-practices', files: [files[0]], findings: [crit] },
        { skill: 'react-best-practices', files: [files[1]], findings: [] },
        { skill: 'repo-checks', files: plan.repo_checks.files, findings: [] },
      ],
    };

    const misplaced = structuredClone(input);
    misplaced.reviews[1].findings.push({ ...crit, file: 'client/src/app/a.tsx' });
    misplaced.reviews.push({ skill: 'made-up-skill', files: [], findings: [] });
    writeFileSync(state('findings.json'), JSON.stringify(misplaced));
    const bad = run('finalize.mjs');
    assert.equal(bad.status, 2);
    assert.match(bad.stderr, /not in this entry's "files"/);
    assert.match(bad.stderr, /unknown skill "made-up-skill"/);

    writeFileSync(state('findings.json'), JSON.stringify(input));
    assert.equal(run('finalize.mjs').status, 1);
    const cache = readJson('cache.json');
    assert.equal(cache.entries['react-best-practices::client/src/app/a.tsx'].findings.length, 1);
    assert.equal(cache.entries['react-best-practices::client/src/app/b.tsx'].findings.length, 0);
  });
});
