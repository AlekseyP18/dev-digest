# Waivers

Documented exceptions for pr-self-review findings. A matching, valid row makes the finding show up under **Waived** in the report instead of counting towards the verdict.

Rules:
- `file`: exact repo path or glob. `rule`: exactly as it appears in the report (`react-best-practices#…`, `repo-checks#i18n`, `hard#focused-test`).
- `reason` is required. `expires` uses `YYYY-MM-DD`; after that date the row is ignored.
- A waiver for a **critical** finding needs `expires`, at most 30 days ahead.
- These cannot be waived: `hard#migration-edited`, `hard#secret-in-code`, `checks#*`.
- Do not put `|` inside a cell. A malformed row is ignored and reported.
- Changing this file shows up in the report as `hard#review-rules-changed`, so reviewers can see it.
- Only a human adds rows. The agent may *propose* a row but never writes one.

| file | rule | severity | reason | expires | author |
|---|---|---|---|---|---|
