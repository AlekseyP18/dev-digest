/* DiffViewer — file cards, parsed lines, inline threads, outdated comments and
   the composer, exercised through the public component. */
import { describe, it, expect, afterEach } from "vitest";
import { screen, cleanup, fireEvent, act } from "@testing-library/react";
import { renderWithIntl } from "@/test/intl";
import { commentApi as api, prFile as file, reviewComment as comment } from "@/test/diff-fixtures";
import { DiffViewer } from "./DiffViewer";

afterEach(cleanup);

describe("DiffViewer", () => {
  it("renders files with their parsed lines; the header toggles the file", () => {
    renderWithIntl(<DiffViewer files={[file()]} />);
    expect(screen.getByText("src/config.ts")).toBeInTheDocument();
    expect(screen.getByText("const key = process.env.KEY;")).toBeInTheDocument();
    const header = screen.getByRole("button", { name: /src\/config\.ts/ });
    expect(header).toHaveAttribute("aria-expanded", "true");
    fireEvent.click(header);
    expect(screen.queryByText("const key = process.env.KEY;")).not.toBeInTheDocument();
  });

  it("shows the empty and no-patch states", () => {
    renderWithIntl(<DiffViewer files={[]} />);
    expect(screen.getByText("No changed files.")).toBeInTheDocument();
    cleanup();
    renderWithIntl(<DiffViewer files={[file({ patch: null })]} />);
    expect(screen.getByText("No diff text available (binary or unfetched patch).")).toBeInTheDocument();
  });

  it("anchors threads to their line and lists unanchored ones as outdated", () => {
    const commenting = api({
      comments: [comment({ id: 1, line: 1 }), comment({ id: 2, line: null, body: "Old remark", is_outdated: true })],
    });
    renderWithIntl(<DiffViewer files={[file()]} commenting={commenting} />);
    expect(screen.getByText("Use the env var")).toBeInTheDocument();
    expect(screen.getByText("1 comment(s) on older revisions")).toBeInTheDocument();
    expect(screen.getByText("Old remark")).toBeInTheDocument();
  });

  it("hides existing threads when comments are toggled off", () => {
    renderWithIntl(<DiffViewer files={[file()]} commenting={api({ showComments: false, comments: [comment({})] })} />);
    expect(screen.queryByText("Use the env var")).not.toBeInTheDocument();
  });

  it("posts a reply to the thread's root on the thread's line", async () => {
    const commenting = api({ comments: [comment({ id: 5, line: 1 })] });
    renderWithIntl(<DiffViewer files={[file()]} commenting={commenting} />);
    fireEvent.click(screen.getByRole("button", { name: "Reply" }));
    fireEvent.change(screen.getByPlaceholderText(/Leave a comment/), { target: { value: "Done" } });
    await act(async () => fireEvent.click(screen.getByRole("button", { name: /Comment/ })));
    expect(commenting.onSubmit).toHaveBeenCalledWith({ path: "src/config.ts", line: 1, side: "RIGHT", body: "Done", in_reply_to: 5 });
  });

  it("the '+' on a line opens a composer targeting that line", async () => {
    const commenting = api();
    renderWithIntl(<DiffViewer files={[file()]} commenting={commenting} />);
    const addedLine = screen.getByText("const key = process.env.KEY;");
    fireEvent.mouseEnter(addedLine.closest("div")!.parentElement!);
    fireEvent.click(screen.getByRole("button", { name: "Add a comment on this line" }));
    fireEvent.change(screen.getByPlaceholderText(/Leave a comment/), { target: { value: "Nice" } });
    await act(async () => fireEvent.keyDown(screen.getByPlaceholderText(/Leave a comment/), { key: "Enter", metaKey: true }));
    expect(commenting.onSubmit).toHaveBeenCalledWith({ path: "src/config.ts", line: 1, side: "RIGHT", body: "Nice" });
  });
});
