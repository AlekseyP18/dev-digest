import { describe, it, expect } from "vitest";
import { formatDateTime, formatTime, toEpoch } from "./format-date";

describe("format-date", () => {
  it("toEpoch parses ISO and maps missing/invalid values to 0", () => {
    expect(toEpoch("2026-01-02T03:04:05Z")).toBe(Date.UTC(2026, 0, 2, 3, 4, 5));
    expect(toEpoch(null)).toBe(0);
    expect(toEpoch(undefined)).toBe(0);
    expect(toEpoch("not a date")).toBe(0);
  });

  it("formatters use the locale and echo unparseable input", () => {
    const iso = "2026-01-02T03:04:05Z";
    expect(formatDateTime(iso)).toBe(new Date(iso).toLocaleString());
    expect(formatTime(iso)).toBe(new Date(iso).toLocaleTimeString());
    expect(formatDateTime("garbage")).toBe("garbage");
    expect(formatTime("garbage")).toBe("garbage");
  });
});
