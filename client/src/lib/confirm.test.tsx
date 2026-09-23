import { describe, it, expect, afterEach, vi } from "vitest";

let pathname = "/repos/r1/pulls/1";
vi.mock("next/navigation", () => ({ usePathname: () => pathname }));
import { screen, cleanup, fireEvent, act } from "@testing-library/react";
import { renderWithIntl } from "@/test/intl";
import { ConfirmProvider, useConfirm } from "./confirm";

afterEach(cleanup);

function Probe({ onResult }: { onResult: (ok: boolean) => void }) {
  const confirm = useConfirm();
  return (
    <button type="button" onClick={async () => onResult(await confirm({ title: "Delete it?", body: "Gone for good.", danger: true }))}>
      ask
    </button>
  );
}

function tree(onResult: (ok: boolean) => void) {
  return (
    <ConfirmProvider>
      <Probe onResult={onResult} />
    </ConfirmProvider>
  );
}

function setup() {
  const onResult = vi.fn();
  const utils = renderWithIntl(tree(onResult));
  return Object.assign(onResult, { rerender: () => utils.rerender(tree(onResult)) });
}

describe("useConfirm", () => {
  it("resolves true on confirm", async () => {
    const onResult = setup();
    fireEvent.click(screen.getByText("ask"));
    expect(screen.getByRole("dialog")).toHaveTextContent("Delete it?");
    expect(screen.getByRole("dialog")).toHaveTextContent("Gone for good.");
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Delete" })));
    expect(onResult).toHaveBeenCalledWith(true);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("resolves false on Cancel and on Escape", async () => {
    const onResult = setup();
    fireEvent.click(screen.getByText("ask"));
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Cancel" })));
    fireEvent.click(screen.getByText("ask"));
    await act(async () => fireEvent.keyDown(window, { key: "Escape" }));
    expect(onResult.mock.calls).toEqual([[false], [false]]);
  });

  it("labels a destructive confirm 'Delete' by default", () => {
    setup();
    fireEvent.click(screen.getByText("ask"));
    expect(screen.getByRole("button", { name: "Delete" })).toBeInTheDocument();
  });

  it("owns the keyboard while open: page shortcuts behind it don't fire", () => {
    const pageShortcut = vi.fn();
    window.addEventListener("keydown", pageShortcut);
    setup();
    fireEvent.click(screen.getByText("ask"));
    fireEvent.keyDown(window, { key: "d" });
    expect(pageShortcut).not.toHaveBeenCalled();
    window.removeEventListener("keydown", pageShortcut);
  });

  it("a second question answers the first one 'no'", async () => {
    const onResult = setup();
    fireEvent.click(screen.getByText("ask"));
    await act(async () => fireEvent.click(screen.getByText("ask")));
    expect(onResult).toHaveBeenCalledWith(false);
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Delete" })));
    expect(onResult.mock.calls).toEqual([[false], [true]]);
  });

  it("navigating away answers 'no' and hides the dialog", async () => {
    pathname = "/repos/r1/pulls/1";
    const onResult = setup();
    fireEvent.click(screen.getByText("ask"));
    pathname = "/agents";
    await act(async () => onResult.rerender());
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(onResult).toHaveBeenCalledWith(false);
    pathname = "/repos/r1/pulls/1";
  });

  it("falls back to window.confirm outside the provider", async () => {
    const spy = vi.spyOn(window, "confirm").mockReturnValue(true);
    const onResult = vi.fn();
    renderWithIntl(<Probe onResult={onResult} />);
    await act(async () => fireEvent.click(screen.getByText("ask")));
    expect(spy).toHaveBeenCalledWith("Delete it?");
    expect(onResult).toHaveBeenCalledWith(true);
    spy.mockRestore();
  });
});
