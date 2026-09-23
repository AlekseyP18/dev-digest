import { describe, it, expect } from "vitest";
import { runOutcome } from "./run-outcome";

describe("runOutcome", () => {
  it("maps lifecycle states before looking at counts", () => {
    expect(runOutcome({ status: "running", blockers: 3, findings_count: 3 })).toBe("running");
    expect(runOutcome({ status: "failed", blockers: 0, findings_count: 0 })).toBe("error");
    expect(runOutcome({ status: "cancelled", blockers: 1, findings_count: 1 })).toBe("cancelled");
  });

  it("judges a finished run by blockers, then findings", () => {
    expect(runOutcome({ status: "done", blockers: 2, findings_count: 5 })).toBe("rejected");
    expect(runOutcome({ status: "done", blockers: 0, findings_count: 5 })).toBe("reviewed");
    expect(runOutcome({ status: "done", blockers: 0, findings_count: 0 })).toBe("approved");
  });

  it("treats missing counts as zero", () => {
    expect(runOutcome({ status: "done", blockers: null, findings_count: null })).toBe("approved");
  });
});
