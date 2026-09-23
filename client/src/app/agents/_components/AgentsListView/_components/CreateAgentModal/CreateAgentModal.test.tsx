import { describe, it, expect, afterEach, vi } from "vitest";
import { screen, cleanup, fireEvent } from "@testing-library/react";
import { renderWithIntl } from "@/test/intl";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
type Cb = { onSuccess?: (a: { id: string }) => void };
const mutate = vi.fn<(input: Record<string, unknown>, cb: Cb) => void>();
vi.mock("@/lib/hooks/agents", () => ({ useCreateAgent: () => ({ mutate, isPending: false }) }));

import { CreateAgentModal } from "./CreateAgentModal";

afterEach(() => {
  cleanup();
  mutate.mockReset();
  push.mockReset();
});

describe("CreateAgentModal", () => {
  it("creates with a default name, closes and opens the new agent", () => {
    mutate.mockImplementation((_input, cb) => cb.onSuccess?.({ id: "new-1" }));
    const onClose = vi.fn();
    renderWithIntl(<CreateAgentModal onClose={onClose} />);
    fireEvent.click(screen.getByRole("button", { name: /Create agent/ }));
    expect(mutate).toHaveBeenCalledWith(expect.objectContaining({ name: "New Agent" }), expect.anything());
    expect(onClose).toHaveBeenCalled();
    expect(push).toHaveBeenCalledWith("/agents/new-1?tab=config");
  });

  it("stays open when creation fails", () => {
    const onClose = vi.fn();
    renderWithIntl(<CreateAgentModal onClose={onClose} />);
    fireEvent.click(screen.getByRole("button", { name: /Create agent/ }));
    expect(onClose).not.toHaveBeenCalled();
  });
});
