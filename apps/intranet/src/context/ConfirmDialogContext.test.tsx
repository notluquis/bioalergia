/**
 * Tests for `ConfirmDialogProvider` / `useConfirmDialog` — Promise-based
 * confirmation surface backed by HeroUI AlertDialog.
 */
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { act } from "react";
import { describe, expect, it, vi } from "vitest";

import { ConfirmDialogProvider, useConfirmDialog } from "./ConfirmDialogContext";

function Probe({ onReady }: { onReady: (confirm: ReturnType<typeof useConfirmDialog>) => void }) {
  const confirm = useConfirmDialog();
  onReady(confirm);
  return null;
}

function mount() {
  let confirmFn!: ReturnType<typeof useConfirmDialog>;
  render(
    <ConfirmDialogProvider>
      <Probe onReady={(c) => (confirmFn = c)} />
    </ConfirmDialogProvider>
  );
  return () => confirmFn;
}

describe("ConfirmDialogProvider", () => {
  it("renders children without opening the dialog by default", () => {
    render(
      <ConfirmDialogProvider>
        <span>child</span>
      </ConfirmDialogProvider>
    );
    expect(screen.getByText("child")).toBeInTheDocument();
  });

  it("resolves true when the user clicks Confirmar", async () => {
    const user = userEvent.setup();
    const getConfirm = mount();

    let promise!: Promise<boolean>;
    act(() => {
      promise = getConfirm()({ title: "Eliminar?", description: "Sin vuelta atrás." });
    });

    const btn = await screen.findByRole("button", { name: "Confirmar" });
    await user.click(btn);
    await expect(promise).resolves.toBe(true);
  });

  it("resolves false when the user clicks Cancelar", async () => {
    const user = userEvent.setup();
    const getConfirm = mount();

    let promise!: Promise<boolean>;
    act(() => {
      promise = getConfirm()({ title: "X", description: "Y" });
    });

    const btn = await screen.findByRole("button", { name: "Cancelar" });
    await user.click(btn);
    await expect(promise).resolves.toBe(false);
  });

  it("uses custom confirm/cancel labels when provided", async () => {
    const getConfirm = mount();
    act(() => {
      void getConfirm()({
        title: "X",
        description: "Y",
        confirmLabel: "Eliminar",
        cancelLabel: "Volver",
      });
    });
    expect(await screen.findByRole("button", { name: "Eliminar" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Volver" })).toBeInTheDocument();
  });

  it("opening a second confirm while the first is pending resolves the first as false", async () => {
    const getConfirm = mount();
    let p1!: Promise<boolean>;
    let p2!: Promise<boolean>;
    act(() => {
      p1 = getConfirm()({ title: "first", description: "f" });
    });
    act(() => {
      p2 = getConfirm()({ title: "second", description: "s" });
    });
    await expect(p1).resolves.toBe(false);
    // p2 still pending — clean up by cancelling
    const user = userEvent.setup();
    const cancel = await screen.findByRole("button", { name: "Cancelar" });
    await user.click(cancel);
    await expect(p2).resolves.toBe(false);
  });

  it("useConfirmDialog throws when called outside the provider", () => {
    function Bad() {
      useConfirmDialog();
      return null;
    }
    // Suppress React's error boundary warning noise.
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(() => render(<Bad />)).toThrow(/within ConfirmDialogProvider/);
    errSpy.mockRestore();
  });
});
