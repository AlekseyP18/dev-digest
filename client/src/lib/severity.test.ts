import { describe, it, expect } from "vitest";
import type { Severity } from "@devdigest/shared";
import {
  SEVERITY_KEYS,
  countBlockers,
  countBySeverity,
  severityRank,
  sortBySeverity,
  totalFindings,
} from "./severity";

const f = (severity: string, dismissed_at: string | null = null) => ({
  severity: severity as Severity,
  dismissed_at,
});

describe("severity", () => {
  it("orders CRITICAL > WARNING > SUGGESTION and puts unknown values last", () => {
    expect(SEVERITY_KEYS).toEqual(["CRITICAL", "WARNING", "SUGGESTION"]);
    expect(severityRank("CRITICAL")).toBeLessThan(severityRank("WARNING"));
    expect(severityRank("WARNING")).toBeLessThan(severityRank("SUGGESTION"));
    expect(severityRank("INFO")).toBe(SEVERITY_KEYS.length);
  });

  it("sortBySeverity returns a new, stable, most-severe-first array", () => {
    const input = [
      { ...f("SUGGESTION"), id: 1 },
      { ...f("CRITICAL"), id: 2 },
      { ...f("WARNING"), id: 3 },
      { ...f("CRITICAL"), id: 4 },
    ];
    const out = sortBySeverity(input);
    expect(out.map((x) => x.id)).toEqual([2, 4, 3, 1]);
    expect(input.map((x) => x.id)).toEqual([1, 2, 3, 4]);
  });

  it("countBySeverity counts known severities and ignores unknown ones", () => {
    expect(countBySeverity([f("CRITICAL"), f("CRITICAL"), f("SUGGESTION"), f("INFO")])).toEqual({
      CRITICAL: 2,
      WARNING: 0,
      SUGGESTION: 1,
    });
  });

  it("totalFindings sums counts and treats null as 0", () => {
    expect(totalFindings({ CRITICAL: 1, WARNING: 2, SUGGESTION: 3 })).toBe(6);
    expect(totalFindings(null)).toBe(0);
    expect(totalFindings(undefined)).toBe(0);
  });

  it("countBlockers counts only undismissed CRITICAL findings", () => {
    expect(
      countBlockers([f("CRITICAL"), f("CRITICAL", "2026-01-01T00:00:00Z"), f("WARNING")]),
    ).toBe(1);
  });
});
