// Shared logic for pr-self-review: diff collection, routing, hard checks, cache, waivers, verdict.
// Pure functions take plain data so they can be unit-tested without git (see lib.test.mjs).
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, lstatSync, readFileSync, readdirSync, readlinkSync } from 'node:fs';
import { dirname, join, posix } from 'node:path';
import { fileURLToPath } from 'node:url';

export const SKILL_DIR = join(dirname(fileURLToPath(import.meta.url)), '..');
export const SEVERITIES = ['critical', 'major', 'minor', 'nit'];
export const MAX_CRITICAL_WAIVER_DAYS = 30;

export const sha256 = (data) => createHash('sha256').update(data).digest('hex');

// ---------- globs ----------

const REGEX_SPECIAL = /[.+^$()|[\]\\]/g;
const globCache = new Map();

export function globToRegExp(glob) {
  let re = '';
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === '*' && glob[i + 1] === '*') {
      if (glob[i + 2] === '/') {
        re += '(?:.*/)?';
        i += 2;
      } else {
        re += '.*';
        i += 1;
      }
    } else if (c === '*') re += '[^/]*';
    else if (c === '?') re += '[^/]';
    else if (c === '{') {
      const end = glob.indexOf('}', i);
      if (end === -1) {
        re += '\\{';
        continue;
      }
      const alts = glob.slice(i + 1, end).split(',').map((a) => a.replace(REGEX_SPECIAL, '\\$&'));
      re += `(?:${alts.join('|')})`;
      i = end;
    } else re += c.replace(REGEX_SPECIAL, '\\$&');
  }
  return new RegExp(`^${re}$`);
}

export function matchesAny(path, globs = []) {
  return globs.some((g) => {
    if (!globCache.has(g)) globCache.set(g, globToRegExp(g));
    return globCache.get(g).test(path);
  });
}

// ---------- git ----------

// Pin everything user git config could change about diff output (prefixes, drivers, path quoting).
const DIFF_FLAGS = ['--no-color', '--no-ext-diff', '--no-textconv', '--src-prefix=a/', '--dst-prefix=b/'];

export function git(args, cwd) {
  return execFileSync('git', ['-c', 'core.quotePath=false', ...args], {
    cwd, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024,
  });
}

/** Undoes git's C-style quoting of unusual paths: "b/a\"b.ts" → b/a"b.ts. */
export function unquotePath(p) {
  if (!p.startsWith('"') || !p.endsWith('"')) return p;
  const bytes = [];
  const s = p.slice(1, -1);
  const ESC = { n: 10, t: 9, r: 13, '"': 34, '\\': 92, a: 7, b: 8, f: 12, v: 11 };
  for (let i = 0; i < s.length; i++) {
    if (s[i] !== '\\') {
      bytes.push(...Buffer.from(s[i]));
    } else if (/[0-7]/.test(s[i + 1])) {
      bytes.push(parseInt(s.slice(i + 1, i + 4), 8));
      i += 3;
    } else {
      bytes.push(ESC[s[i + 1]] ?? s.charCodeAt(i + 1));
      i += 1;
    }
  }
  return Buffer.from(bytes).toString('utf8');
}

export function repoRoot(cwd = process.cwd()) {
  return git(['rev-parse', '--show-toplevel'], cwd).trim();
}

export function resolveBase(root, base) {
  for (const ref of [base, `origin/${base}`]) {
    try {
      git(['rev-parse', '--verify', '--quiet', `${ref}^{commit}`], root);
      return ref;
    } catch {
      // try next candidate
    }
  }
  throw new Error(`Base ref "${base}" not found (tried ${base}, origin/${base}). Pass --base <ref>.`);
}

export function currentBranch(root) {
  return git(['rev-parse', '--abbrev-ref', 'HEAD'], root).trim();
}

/** Parses `git diff --name-status -z -M` output. */
export function parseNameStatus(raw) {
  const parts = raw.split('\0').filter((p) => p !== '');
  const out = [];
  for (let i = 0; i < parts.length; ) {
    const code = parts[i++];
    const kind = code[0];
    if (kind === 'R' || kind === 'C') {
      const oldPath = parts[i++];
      const path = parts[i++];
      out.push({ path, oldPath, status: kind === 'R' ? 'R' : 'A' });
    } else {
      out.push({ path: parts[i++], status: kind === 'T' ? 'M' : kind });
    }
  }
  return out;
}

/** Parses `git diff -U0` output into { [path]: [{ line, text }] } of added lines. */
export function parseAddedLines(raw) {
  const result = {};
  let current = null;
  let lineNo = 0;
  for (const line of raw.split('\n')) {
    if (line.startsWith('+++ ')) {
      // git appends a TAB after names containing spaces, and C-quotes names with special chars
      const target = unquotePath(line.slice(4).replace(/\t$/, ''));
      current = target === '/dev/null' ? null : target.replace(/^b\//, '');
      if (current) result[current] ??= [];
    } else if (line.startsWith('@@')) {
      const m = /\+(\d+)/.exec(line);
      lineNo = m ? Number(m[1]) : 0;
    } else if (current && line.startsWith('+')) {
      result[current].push({ line: lineNo++, text: line.slice(1) });
    }
  }
  return result;
}

function isProbablyText(buf) {
  return buf.length < 2 * 1024 * 1024 && !buf.subarray(0, 8000).includes(0);
}

/**
 * All local changes vs the merge-base with `base`: branch commits + staged + unstaged + untracked.
 * Returns files with status and added lines, plus a hash that changes whenever any of it changes.
 */
export function collectChanges(root, base) {
  const baseRef = resolveBase(root, base);
  const mergeBase = git(['merge-base', baseRef, 'HEAD'], root).trim();

  const tracked = parseNameStatus(git(['diff', '--name-status', '-z', '-M', mergeBase], root));
  const untracked = git(['ls-files', '--others', '--exclude-standard', '-z'], root)
    .split('\0')
    .filter(Boolean)
    .map((path) => ({ path, status: 'A', untracked: true }));

  const added = parseAddedLines(git(['diff', ...DIFF_FLAGS, '-U0', '-M', mergeBase], root));

  const files = [...tracked, ...untracked].sort((a, b) => a.path.localeCompare(b.path));
  for (const f of files) {
    const abs = join(root, f.path);
    if (f.status === 'D' || !existsSync(abs)) {
      f.contentHash = 'deleted';
      f.added = [];
      continue;
    }
    const stat = lstatSync(abs);
    if (!stat.isFile()) {
      // symlink or gitlink/submodule dir: hash what git sees, never review it as code
      const target = stat.isSymbolicLink() ? readlinkSync(abs) : 'directory';
      f.contentHash = sha256(`${stat.isSymbolicLink() ? 'link' : 'dir'}:${target}`);
      f.binary = true;
      f.added = [];
      continue;
    }
    const buf = readFileSync(abs);
    f.contentHash = sha256(buf);
    f.binary = !isProbablyText(buf);
    if (f.untracked) {
      f.added = f.binary
        ? []
        : buf.toString('utf8').split('\n').map((text, i) => ({ line: i + 1, text }));
    } else {
      f.added = added[f.path] ?? [];
    }
  }

  return { baseRef, mergeBase, diffHash: treeDeltaHash(mergeBase, files), files };
}

/**
 * Canonical hash of "what differs from the merge-base": path → content for every changed path.
 * Independent of staging and committing (untracked, staged, committed and renamed-vs-add+delete all
 * hash the same), so committing a reviewed diff keeps its verdict valid, while any content change breaks it.
 */
export function treeDeltaHash(mergeBase, files) {
  const state = new Map();
  for (const f of files) {
    if (f.oldPath) state.set(f.oldPath, state.get(f.oldPath) ?? 'deleted');
    state.set(f.path, f.contentHash);
  }
  const h = createHash('sha256').update(`base:${mergeBase}`);
  for (const [path, content] of [...state].sort(([a], [b]) => a.localeCompare(b))) h.update(`\0${path}\0${content}`);
  return h.digest('hex');
}

/** Hash only — used by the gate; must match collectChanges().diffHash. */
export function computeDiffHash(root, base) {
  return collectChanges(root, base).diffHash;
}

export function readAtCommit(root, commit, path) {
  try {
    return git(['show', `${commit}:${path}`], root);
  } catch {
    return null;
  }
}

// ---------- skills & routing ----------

export function discoverSkills(skillsDir) {
  if (!existsSync(skillsDir)) return [];
  return readdirSync(skillsDir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && existsSync(join(skillsDir, d.name, 'SKILL.md')))
    .map((d) => d.name)
    .sort();
}

function allowedStatus(rule, path, status) {
  for (const [glob, statuses] of Object.entries(rule.statusesByPath ?? {})) {
    if (matchesAny(path, [glob])) return statuses.includes(status);
  }
  return !rule.statuses || rule.statuses.includes(status);
}

const regexCache = new Map();
const toRegex = (src) => {
  if (!regexCache.has(src)) regexCache.set(src, new RegExp(src));
  return regexCache.get(src);
};

/** Why a file goes to a skill: 'path', 'content', or null. */
export function routeReason(file, rule, config) {
  if (rule.paths && matchesAny(file.path, rule.paths) && allowedStatus(rule, file.path, file.status)) {
    return 'path';
  }
  if (rule.content && matchesAny(file.path, config.codeFiles)) {
    if (rule.contentIn && !matchesAny(file.path, rule.contentIn)) return null;
    const regexes = rule.content.map(toRegex);
    if (file.added.some((l) => regexes.some((r) => r.test(l.text)))) return 'content';
  }
  return null;
}

/**
 * Splits changed files into reviewable / excluded / deleted and routes reviewable ones to skills.
 * `installed` = skill folder names that have a SKILL.md.
 */
export function routeFiles(files, config, installed) {
  const excluded = [];
  const deleted = [];
  const reviewable = [];
  for (const f of files) {
    if (matchesAny(f.path, config.exclude)) excluded.push(f.path);
    else if (f.status === 'D') deleted.push(f.path);
    else if (f.binary) excluded.push(f.path);
    else reviewable.push(f);
  }

  const routing = {};
  for (const [skill, rule] of Object.entries(config.skills)) {
    if (!installed.includes(skill)) continue;
    const routed = [];
    for (const f of reviewable) {
      const reason = routeReason(f, rule, config);
      if (reason) routed.push({ path: f.path, reason });
    }
    if (routed.length) routing[skill] = routed;
  }

  const mapped = new Set([...Object.keys(config.skills), ...config.toolSkills]);
  return {
    reviewable: reviewable.map((f) => f.path),
    excluded,
    deleted,
    routing,
    unmappedSkills: installed.filter((s) => !mapped.has(s)),
    missingSkills: Object.keys(config.skills).filter((s) => !installed.includes(s)),
  };
}

// ---------- hard checks ----------

const SECRET_PATTERNS = [
  /\bsk-(?:or-v1-|ant-|proj-)?[A-Za-z0-9_-]{24,}/,
  /\bgh[pousr]_[A-Za-z0-9]{36,}/,
  /\bgithub_pat_[A-Za-z0-9_]{22,}/,
  /\bAKIA[0-9A-Z]{16}\b/,
  /\bxox[abprs]-[A-Za-z0-9-]{10,}/,
  /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/,
  /\b(?:api[_-]?key|secret|token|password)\b["']?\s*[:=]\s*["'][^"'\s]{16,}["']/i,
];
const FOCUSED_TEST = /\b(?:describe|it|test|suite)\.(?:only|skip)\s*\(/;
const PG_HELPER_IMPORT = /from\s+['"][^'"]*test\/helpers\/pg(?:\.js|\.ts)?['"]/;
const TEST_FILE = ['**/*.{test,spec}.{ts,tsx,mts,js,mjs}'];
const MIGRATION_FILES = ['server/src/db/migrations/*.sql', 'server/src/db/migrations/meta/*_snapshot.json'];
const LOCKFILES = ['pnpm-lock.yaml', 'package-lock.json'];
const SHARED_DIRS = ['server/src/vendor/shared/', 'client/src/vendor/shared/'];
const REVIEW_RULE_FILES = [
  '.claude/skills/pr-self-review/{waivers.md,config.json}',
  '.claude/skills/pr-self-review/references/{severity,repo-checks}.md',
];

export function findingId(f) {
  return sha256(`${f.rule}|${f.file}|${f.line ?? 0}|${f.message}`).slice(0, 12);
}

function hard(rule, severity, file, line, message, fix, extra = {}) {
  const f = { source: 'hard', skill: 'hard', rule: `hard#${rule}`, severity, file, line, message, fix, ...extra };
  f.id = findingId(f);
  return f;
}

/**
 * Deterministic checks for the repo's "Do not touch" / global rules.
 * io = { readNow(path) -> string|null, readBase(path) -> string|null } so tests can fake the repo.
 */
export function hardChecks(files, io) {
  const out = [];
  const changed = new Set(files.map((f) => f.path));

  for (const f of files) {
    // H1 — existing migrations are immutable (new ones come from `pnpm db:generate`)
    const migPath = f.status === 'R' ? f.oldPath : f.path;
    if (['M', 'D', 'R'].includes(f.status) && matchesAny(migPath, MIGRATION_FILES)) {
      out.push(hard('migration-edited', 'critical', migPath, null,
        `Existing migration was ${{ M: 'modified', D: 'deleted', R: 'renamed' }[f.status]}.`,
        `Restore it (git checkout <merge-base> -- ${migPath}) and generate a new migration with \`pnpm db:generate\`.`));
    }

    // H2 — lockfile changed without its package.json. Can be legit (`pnpm dedupe`, transitive update),
    // so it is a warning: confirm it came from the package manager, not a hand edit.
    const name = posix.basename(f.path);
    if (LOCKFILES.includes(name)) {
      const dir = posix.dirname(f.path);
      const manifest = dir === '.' ? 'package.json' : `${dir}/package.json`;
      if (!changed.has(manifest)) {
        out.push(hard('lockfile-without-manifest', 'major', f.path, null,
          `Lockfile changed but ${manifest} did not — make sure it came from the package manager, not a hand edit.`,
          `If unsure: restore the lockfile and re-run the package manager (pnpm/npm install) in ${dir}.`));
      }
    }

    // H7 — the review's own rules changed in this diff: a human must see that
    if (matchesAny(f.path, REVIEW_RULE_FILES)) {
      out.push(hard('review-rules-changed', 'major', f.path, null,
        'This diff changes pr-self-review rules (waivers / routing / severity). Only a human may do that.',
        'Confirm the change is intentional and human-authored.'));
    }

    if (f.binary) continue;
    const isTest = matchesAny(f.path, TEST_FILE);
    for (const { line, text } of f.added) {
      // H3 — focused / skipped tests
      if (isTest && FOCUSED_TEST.test(text)) {
        out.push(hard('focused-test', 'critical', f.path, line,
          'Focused or skipped test (.only / .skip) — hides the rest of the suite.',
          'Remove .only/.skip or implement the test.', { quote: text.trim() }));
      }
      // H4 — secrets (confirmed by a verifier: may be an obvious fake fixture)
      if (SECRET_PATTERNS.some((r) => r.test(text))) {
        out.push(hard('secret-in-code', 'critical', f.path, line,
          'Looks like a real secret/token. Secrets live only in ~/.devdigest/secrets.json.',
          'Remove it, rotate the key if it was real, load it via LocalSecretsProvider.',
          { quote: text.trim().slice(0, 160), needs_verification: true }));
      }
      // H6 — Postgres test helper requires *.it.test.ts (CI split depends on it)
      if (isTest && PG_HELPER_IMPORT.test(text) && !f.path.endsWith('.it.test.ts')) {
        out.push(hard('it-test-naming', 'major', f.path, line,
          'Imports test/helpers/pg but the file is not named *.it.test.ts — CI unit job will need Docker.',
          'Rename the file to *.it.test.ts.'));
      }
    }
  }

  // H5 — the two @devdigest/shared copies must not drift apart because of this diff
  const seen = new Set();
  for (const f of files) {
    const dir = SHARED_DIRS.find((d) => f.path.startsWith(d));
    if (!dir || f.status === 'D') continue;
    const rel = f.path.slice(dir.length);
    if (seen.has(rel)) continue;
    seen.add(rel);
    const [a, b] = SHARED_DIRS.map((d) => d + rel);
    const nowA = io.readNow(a);
    const nowB = io.readNow(b);
    if (nowA !== null && nowB !== null) {
      if (nowA === nowB) continue;
      const baseA = io.readBase(a);
      const baseB = io.readBase(b);
      const wasInSync = baseA === null || baseB === null || baseA === baseB;
      if (wasInSync) {
        out.push(hard('shared-contract-drift', 'critical', f.path, null,
          `@devdigest/shared copies diverged: ${a} ≠ ${b}.`,
          'Apply the same change to both copies (server first, then client).'));
      }
    } else {
      const other = nowA === null ? a : b;
      out.push(hard('shared-contract-drift', 'major', f.path, null,
        `New shared contract file has no copy at ${other}.`,
        'Add the client copy if the client consumes it; otherwise waive with a reason.'));
    }
  }
  return out;
}

// ---------- cache ----------

export function pairKey(skill, path) {
  return `${skill}::${path}`;
}

/** Merge-base is part of the key: after a rebase the same content can have different changed lines. */
export function cacheEntryKey({ contentHash, skillHash, configHash, mergeBase }) {
  return sha256(`${contentHash}:${skillHash}:${configHash}:${mergeBase}`);
}

/** Hash of a whole skill folder (SKILL.md + references), so editing any rule file invalidates its cache. */
export function dirHash(dir) {
  const h = createHash('sha256');
  const walk = (d) => {
    for (const e of readdirSync(d, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      if (e.name === '.omc' || e.name === 'node_modules') continue;
      const p = join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.isFile()) h.update(`${p.slice(dir.length)}\0`).update(readFileSync(p));
    }
  };
  walk(dir);
  return h.digest('hex');
}

/** Uncommitted paths (staged, unstaged, untracked) outside config.exclude. A PR ships HEAD, not these. */
export function uncommittedPaths(root, config) {
  const parts = git(['status', '--porcelain', '-z'], root).split('\0').filter(Boolean);
  const out = [];
  for (let i = 0; i < parts.length; i++) {
    const entry = parts[i];
    if (/^[RC]/.test(entry)) i++; // rename/copy: next part is the source path
    const path = entry.slice(3);
    if (!matchesAny(path, config.exclude)) out.push(path);
  }
  return out;
}

// ---------- waivers ----------

/**
 * Parses the markdown table in waivers.md. Rows with the wrong column count (e.g. a `|` inside
 * the reason) come back as { malformed: '<row>' } so the report can show them.
 */
export function parseWaivers(markdown) {
  const rows = [];
  for (const raw of markdown.split('\n')) {
    const line = raw.trim();
    if (!line.startsWith('|')) continue;
    const cells = line.slice(1, line.endsWith('|') ? -1 : undefined).split('|').map((c) => c.trim().replace(/^`|`$/g, ''));
    if (cells.length !== 6) {
      rows.push({ malformed: line });
      continue;
    }
    if (cells[0].toLowerCase() === 'file' || /^:?-+:?$/.test(cells[0])) continue;
    const [file, rule, severity, reason, expires, author] = cells;
    rows.push({ file, rule, severity, reason, expires, author });
  }
  return rows;
}

const DAY = 24 * 60 * 60 * 1000;

export function waiverProblem(w, today) {
  if (!w.reason) return 'missing reason';
  if (w.expires) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(w.expires)) return `bad expires "${w.expires}" (want YYYY-MM-DD)`;
    const exp = Date.parse(`${w.expires}T23:59:59Z`);
    if (Number.isNaN(exp) || new Date(exp).toISOString().slice(0, 10) !== w.expires) {
      return `invalid date "${w.expires}"`;
    }
    if (exp < today.getTime()) return `expired ${w.expires}`;
    if (w.severity === 'critical' && exp - today.getTime() > MAX_CRITICAL_WAIVER_DAYS * DAY) {
      return `critical waiver longer than ${MAX_CRITICAL_WAIVER_DAYS} days`;
    }
  } else if (w.severity === 'critical') {
    return 'critical waiver needs expires';
  }
  return null;
}

/** Marks findings covered by a valid waiver. Returns problems for invalid waivers that matched something. */
export function applyWaivers(findings, waivers, config, today = new Date()) {
  const problems = waivers.filter((w) => w.malformed).map((w) => `malformed waiver row (need 6 cells, no "|" in text): ${w.malformed}`);
  const valid = waivers.filter((w) => !w.malformed);
  const nonWaivable = new Set(config.nonWaivableRules);
  for (const f of findings) {
    const w = valid.find((x) => x.rule === f.rule && (x.file === f.file || matchesAny(f.file, [x.file])));
    if (!w) continue;
    if (nonWaivable.has(f.rule)) {
      problems.push(`${f.rule} at ${f.file} cannot be waived — waiver ignored`);
      continue;
    }
    const problem = waiverProblem({ ...w, severity: f.severity }, today);
    if (problem) {
      problems.push(`waiver ${w.file} · ${w.rule}: ${problem} — ignored`);
      continue;
    }
    f.waived = { reason: w.reason, expires: w.expires || null, author: w.author };
  }
  return problems;
}

// ---------- findings ----------

const rank = (s) => SEVERITIES.indexOf(s);

/** Same file:line reported by several skills → one finding with the worst severity. */
export function dedupe(findings) {
  const groups = new Map();
  for (const f of findings) {
    const key = f.line == null ? Symbol('no-line') : `${f.file}:${f.line}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(f);
  }
  return [...groups.values()].map((group) => {
    const [keep, ...rest] = [...group].sort((a, b) => rank(a.severity) - rank(b.severity));
    return {
      ...keep,
      sources: [...new Set(group.map((g) => g.skill))],
      also: rest.map(({ skill, rule, severity, message }) => ({ skill, rule, severity, message })),
    };
  });
}

export function verdictOf(findings) {
  const active = findings.filter((f) => !f.waived);
  const counts = Object.fromEntries(SEVERITIES.map((s) => [s, active.filter((f) => f.severity === s).length]));
  const verdict = counts.critical > 0 ? 'BLOCKED' : active.length > 0 ? 'PASS WITH WARNINGS' : 'PASS';
  return { verdict, counts };
}

export function validateFinding(f) {
  const errors = [];
  for (const k of ['file', 'rule', 'severity', 'message']) if (!f[k]) errors.push(`missing ${k}`);
  if (f.severity && !SEVERITIES.includes(f.severity)) errors.push(`bad severity "${f.severity}"`);
  if (f.line != null && !Number.isInteger(f.line)) errors.push('line must be an integer');
  if (f.severity === 'critical' && !['confirmed', 'downgraded', 'rejected'].includes(f.verification)) {
    errors.push('critical finding needs verification: confirmed | downgraded | rejected');
  }
  if (f.verification === 'downgraded' && !SEVERITIES.includes(f.verified_severity)) {
    errors.push('downgraded finding needs verified_severity');
  }
  return errors;
}

// ---------- state files ----------

export function stateDir(root) {
  return join(root, '.omc', 'pr-self-review');
}

export function loadJson(path, fallback) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return fallback;
  }
}

export function loadConfig() {
  return JSON.parse(readFileSync(join(SKILL_DIR, 'config.json'), 'utf8'));
}

/** Hash of everything that changes how a skill judges code: config, severity rules, reviewer prompt. */
export function configHash() {
  const parts = ['config.json', 'references/severity.md', 'references/reviewer-prompt.md', 'references/repo-checks.md'];
  return sha256(parts.map((p) => {
    const abs = join(SKILL_DIR, p);
    return existsSync(abs) ? readFileSync(abs) : '';
  }).join('\0'));
}

export function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) args._.push(a);
    else if (argv[i + 1] && !argv[i + 1].startsWith('--')) args[a.slice(2)] = argv[++i];
    else args[a.slice(2)] = true;
  }
  return args;
}

export const safeName = (s) => s.replace(/[^A-Za-z0-9._-]+/g, '-');
