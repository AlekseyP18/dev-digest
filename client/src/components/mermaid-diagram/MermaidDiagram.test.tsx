import { describe, it, expect, afterEach, vi } from "vitest";
import { render, cleanup } from "@testing-library/react";

const mermaidImport = vi.fn();
vi.mock("mermaid", () => {
  mermaidImport();
  return { default: { initialize: vi.fn(), parse: vi.fn(async () => false), render: vi.fn() } };
});

import { MermaidDiagram } from "./MermaidDiagram";

afterEach(cleanup);

describe("MermaidDiagram", () => {
  it("renders nothing and never loads mermaid for non-diagram input", () => {
    const { container } = render(<MermaidDiagram chart={'{"type":"Buffer"}'} />);
    expect(container.firstChild).toBeNull();
    expect(mermaidImport).not.toHaveBeenCalled();
  });

  it("keeps the box hidden while a diagram is pending", () => {
    const { container } = render(<MermaidDiagram chart={"flowchart TD\n A-->B"} />);
    expect((container.firstChild as HTMLElement).style.display).toBe("none");
  });
});
