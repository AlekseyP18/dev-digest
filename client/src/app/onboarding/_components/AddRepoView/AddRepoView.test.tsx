import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { screen, cleanup, fireEvent } from "@testing-library/react";
import { renderWithIntl } from "@/test/intl";
import { ApiError } from "@/lib/api";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

type Callbacks = { onSuccess?: (repo: { id: string }) => void; onError?: (e: unknown) => void };
const mutate = vi.fn<(url: string, cb: Callbacks) => void>();
vi.mock("@/lib/hooks/core", () => ({ useAddRepo: () => ({ mutate, isPending: false }) }));

import { AddRepoView } from "./AddRepoView";

beforeEach(() => {
  push.mockReset();
  mutate.mockReset();
});
afterEach(cleanup);

const typeUrl = (value: string) =>
  fireEvent.change(screen.getByPlaceholderText("https://github.com/owner/repo"), { target: { value } });

describe("AddRepoView", () => {
  it("renders the form with the translated heading and field", () => {
    renderWithIntl(<AddRepoView />);
    expect(screen.getByRole("heading", { name: "Add a repository" })).toBeInTheDocument();
    expect(screen.getByText("Repository URL")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Settings → API Keys" })).toHaveAttribute("href", "/settings/api-keys");
    expect(screen.getByRole("button", { name: /Add repository/ })).toBeDisabled();
  });

  it("submits the trimmed URL and opens the new repo's PR list", () => {
    mutate.mockImplementation((_url, cb) => cb.onSuccess?.({ id: "r1" }));
    renderWithIntl(<AddRepoView />);
    typeUrl("  https://github.com/acme/api  ");
    fireEvent.click(screen.getByRole("button", { name: /Add repository/ }));
    expect(mutate).toHaveBeenCalledWith("https://github.com/acme/api", expect.anything());
    expect(push).toHaveBeenCalledWith("/repos/r1/pulls");
  });

  it("shows the API error inline and stays on the form", () => {
    mutate.mockImplementation((_url, cb) => cb.onError?.(new ApiError("Repository not found", 404)));
    renderWithIntl(<AddRepoView />);
    typeUrl("https://github.com/acme/nope");
    fireEvent.keyDown(screen.getByPlaceholderText("https://github.com/owner/repo"), { key: "Enter" });
    expect(screen.getByRole("alert")).toHaveTextContent("Repository not found");
    expect(push).not.toHaveBeenCalled();
  });

  it("Esc closes the screen", () => {
    renderWithIntl(<AddRepoView />);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(push).toHaveBeenCalledWith("/");
  });
});
