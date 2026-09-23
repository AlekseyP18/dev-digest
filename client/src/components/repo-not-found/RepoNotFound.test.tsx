import { describe, it, expect, afterEach, vi } from "vitest";
import { screen, cleanup, fireEvent } from "@testing-library/react";
import { renderWithIntl } from "@/test/intl";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

import { RepoNotFound } from "./RepoNotFound";

afterEach(cleanup);

describe("RepoNotFound", () => {
  it("explains the stale repo and links to onboarding", () => {
    renderWithIntl(<RepoNotFound />);
    expect(screen.getByText("No repo selected")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Add repository" }));
    expect(push).toHaveBeenCalledWith("/onboarding");
  });
});
