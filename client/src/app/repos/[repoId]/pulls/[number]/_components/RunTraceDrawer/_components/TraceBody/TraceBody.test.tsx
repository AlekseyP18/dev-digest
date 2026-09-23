import { describe, it, expect, afterEach } from "vitest";
import { screen, cleanup } from "@testing-library/react";
import type { RunTrace } from "@devdigest/shared";
import { renderWithIntl } from "@/test/intl";
import { TraceBody } from "./TraceBody";

afterEach(cleanup);

const TRACE: RunTrace = {
  config: { agent: "Security", version: "1", provider: "openai", model: "gpt-4.1", pr: 482, source: "local" },
  stats: { duration_ms: 8200, tokens_in: 12000, tokens_out: 1500, cost_usd: null, findings: 0, grounding: "0/0 passed" },
  prompt_assembly: { system: "sys", skills: null, memory: null, specs: null, user: "usr" },
  tool_calls: [],
  raw_output: "",
  memory_pulled: [],
  specs_read: ["specs/001-auth.md"],
  log: [],
};

describe("TraceBody", () => {
  it("renders config, specs read, unknown cost as a dash, and empty tool calls", () => {
    renderWithIntl(<TraceBody trace={TRACE} findings={[]} />);
    expect(screen.getByText("gpt-4.1")).toBeInTheDocument();
    expect(screen.getByText("specs/001-auth.md")).toBeInTheDocument();
    expect(screen.getByText("No tool calls recorded.")).toBeInTheDocument();
    expect(screen.queryByText("$0.00")).not.toBeInTheDocument();
  });
});
