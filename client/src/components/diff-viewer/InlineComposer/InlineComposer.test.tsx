import { describe, it, expect, afterEach, vi } from "vitest";
import { screen, cleanup, fireEvent, act } from "@testing-library/react";
import { renderWithIntl } from "@/test/intl";
import { commentApi } from "@/test/diff-fixtures";
import { InlineComposer } from "./InlineComposer";

afterEach(cleanup);

function setup(api = commentApi()) {
  const onClose = vi.fn();
  renderWithIntl(<InlineComposer commenting={api} path="src/a.ts" line={4} side="LEFT" onClose={onClose} />);
  return { api, onClose, box: screen.getByPlaceholderText(/Leave a comment/) };
}

describe("InlineComposer", () => {
  it("won't post an empty comment", () => {
    setup();
    expect(screen.getByRole("button", { name: /Comment/ })).toBeDisabled();
  });

  it("posts with ⌘/Ctrl+Enter and closes on success", async () => {
    const { api, onClose, box } = setup();
    fireEvent.change(box, { target: { value: "  looks off  " } });
    await act(async () => fireEvent.keyDown(box, { key: "Enter", ctrlKey: true }));
    expect(api.onSubmit).toHaveBeenCalledWith({ path: "src/a.ts", line: 4, side: "LEFT", body: "looks off" });
    expect(onClose).toHaveBeenCalled();
  });

  it("keeps the draft open when posting fails", async () => {
    const api = commentApi({ onSubmit: vi.fn(async () => Promise.reject(new Error("422"))) });
    const { onClose, box } = setup(api);
    fireEvent.change(box, { target: { value: "draft" } });
    await act(async () => fireEvent.click(screen.getByRole("button", { name: /Comment/ })));
    expect(onClose).not.toHaveBeenCalled();
    expect(box).toHaveValue("draft");
  });

  it("Escape cancels", () => {
    const { onClose, box } = setup();
    fireEvent.keyDown(box, { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });
});
