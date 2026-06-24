/**
 * Tests for `AppModal` — shared HeroUI Modal shell.
 */
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { AppModal } from "./AppModal";

describe("AppModal", () => {
  it("does not render its body to the document when closed", () => {
    render(
      <AppModal isOpen={false} onClose={() => undefined} title="Hidden">
        <p>body-text</p>
      </AppModal>
    );
    expect(screen.queryByText("body-text")).not.toBeInTheDocument();
  });

  it("renders title + children when open", async () => {
    render(
      <AppModal isOpen onClose={() => undefined} title="Mi modal">
        <p>contenido</p>
      </AppModal>
    );
    expect(await screen.findByText("Mi modal")).toBeInTheDocument();
    expect(screen.getByText("contenido")).toBeInTheDocument();
  });

  it("renders the footer slot when provided", async () => {
    render(
      <AppModal isOpen onClose={() => undefined} title="X" footer={<button>OK</button>}>
        body
      </AppModal>
    );
    expect(await screen.findByRole("button", { name: "OK" })).toBeInTheDocument();
  });

  it("calls onClose when the backdrop dismisses the modal (Escape key)", async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(
      <AppModal isOpen onClose={onClose} title="X">
        body
      </AppModal>
    );
    await screen.findByText("body");
    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalled();
  });

  it("accepts size prop without crashing", async () => {
    render(
      <AppModal isOpen onClose={() => undefined} title="L" size="lg">
        body
      </AppModal>
    );
    expect(await screen.findByText("body")).toBeInTheDocument();
  });
});
