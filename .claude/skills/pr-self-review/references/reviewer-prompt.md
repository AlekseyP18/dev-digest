# Reviewer & verifier prompts

Templates the orchestrator fills from `plan.json`. `{…}` are placeholders.

## Reviewer (one per skill, or per chunk of ≤ 20 files)

```
You are a reviewer for the "{skill}" skill in a pre-PR self-review of the DevDigest repo ({repo_root}).

1. Read {skill_md} fully. Also read any of its reference files that apply to these changes
   (for onion-architecture: run the rg commands from references/audit.md on the changed files only,
   and compare hits with references/devdigest-server.md#known-debt).
2. Read .claude/skills/pr-self-review/references/severity.md — use exactly those levels.
3. For each file below, look at what changed:
   - tracked file: `git diff {merge_base} -- <file>`
   - untracked file (whole file is new): read it
   Read surrounding code only as needed to judge the changed lines.

Files:
{file list; untracked marked "(new, untracked)"}

Report ONLY violations of rules from {skill} on changed lines. No praise, no summaries, no issues
outside this skill's scope, no findings on untouched old code.

Reply with ONLY this JSON (no prose):
{
  "skill": "{skill}",
  "files": [<every file above that you actually reviewed>],
  "findings": [
    {
      "file": "client/src/app/x/Foo.tsx",
      "line": 42,
      "severity": "critical | major | minor | nit",
      "rule": "{skill}#<section-slug of the rule in SKILL.md or its reference>",
      "quote": "<the offending line, verbatim, trimmed>",
      "message": "<what is wrong and why it matters — one or two sentences>",
      "fix": "<concrete change>"
    }
  ]
}
```

Rules for the orchestrator:
- `files` must list every file you gave the reviewer. `finalize.mjs` rejects the run if any planned file is missing.
- If a reviewer's JSON is invalid, ask the same reviewer once to fix it. Do not rewrite its findings yourself.

## repo-checks reviewer

Same as the reviewer template, with `skill = "repo-checks"`. It reads `references/repo-checks.md` instead of a skill's `SKILL.md`, and gets every file in `plan.repo_checks.files`.

## Verifier (one per critical finding; never the agent that raised it)

```
Verify one finding from a pre-PR review of the DevDigest repo ({repo_root}). Be skeptical: your job
is to prevent false blockers.

Finding: {finding JSON}
Rule source: {skill_md or references/repo-checks.md}
Severity rules: .claude/skills/pr-self-review/references/severity.md

Open the file at the line, read enough context, check the rule actually says this, and check
whether the diff introduced it (`git diff {merge_base} -- {file}`).

Reply with ONLY JSON:
{ "verification": "confirmed" | "downgraded" | "rejected",
  "verified_severity": "major | minor | nit (only when downgraded)",
  "reason": "<one sentence>" }
```

Copy `verification`, `verified_severity` and `reason` (as `verification_reason`) into the finding before you write `findings.json`.

For hard findings with `needs_verification` (possible secrets), use the same verifier. Record the result in `hard_verifications[<id>]` as `confirmed` or `rejected`. A value that is clearly fake, such as `"sk-test-xxx"` in a test fixture, counts as rejected.
