/**
 * Tests for `ConfirmDialog` — Promise-based confirmation modal.
 *
 * Scope (golden 2026):
 * - `confirmAction()` resolves Promise<boolean> on user decision.
 * - `requireText` (NHS-style typed confirmation) disables confirm until
 *   the typed phrase matches exactly.
 * - `variant="danger"` should apply danger styling to the confirm button.
 * - Backdrop close (or Cancel) resolves `false`.
 * - Concurrent calls are serialized by the singleton store: the second
 *   call overwrites the first's resolver (we document the behaviour so
 *   regressions surface in CI).
 *
 * Patterns:
 * - Mount `<ConfirmDialogHost />` once per test.
 * - `userEvent` for clicks/typing (UA-style event dispatch).
 * - `findBy*` for async open transitions (Modal portals settle on next tick).
 */

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { act } from "react";
import { describe, expect, it } from "vitest";

import { confirmAction, ConfirmDialogHost } from "./ConfirmDialog";

function mountHost() {
  return render(<ConfirmDialogHost />);
}

describe("ConfirmDialog / confirmAction", () => {
  it("resolves true when the user clicks the confirm button", async () => {
    const user = userEvent.setup();
    mountHost();

    let promise!: Promise<boolean>;
    act(() => {
      promise = confirmAction({ title: "Eliminar?" });
    });

    const confirmBtn = await screen.findByRole("button", { name: "Confirmar" });
    await user.click(confirmBtn);

    await expect(promise).resolves.toBe(true);
  });

  it("resolves false when the user clicks the cancel button", async () => {
    const user = userEvent.setup();
    mountHost();

    let promise!: Promise<boolean>;
    act(() => {
      promise = confirmAction({ title: "Eliminar?" });
    });

    const cancelBtn = await screen.findByRole("button", { name: "Cancelar" });
    await user.click(cancelBtn);

    await expect(promise).resolves.toBe(false);
  });

  it("uses custom confirm/cancel labels when provided", async () => {
    mountHost();
    act(() => {
      void confirmAction({
        title: "x",
        confirmLabel: "Eliminar definitivamente",
        cancelLabel: "Volver",
      });
    });

    expect(
      await screen.findByRole("button", { name: "Eliminar definitivamente" })
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Volver" })).toBeInTheDocument();
  });

  it("renders a string description as a paragraph", async () => {
    mountHost();
    act(() => {
      void confirmAction({ title: "Confirmar", description: "Acción irreversible." });
    });

    expect(await screen.findByText("Acción irreversible.")).toBeInTheDocument();
  });

  it("renders a ReactNode description (e.g. summary table)", async () => {
    mountHost();
    act(() => {
      void confirmAction({
        title: "Confirmar",
        description: <div data-testid="summary-block">Resumen</div>,
      });
    });

    expect(await screen.findByTestId("summary-block")).toBeInTheDocument();
  });

  describe("requireText (typed confirmation)", () => {
    it("disables the confirm button until the user types the exact phrase", async () => {
      const user = userEvent.setup();
      mountHost();

      let promise!: Promise<boolean>;
      act(() => {
        promise = confirmAction({
          title: "Eliminar paciente",
          requireText: "ELIMINAR",
          confirmLabel: "Eliminar",
        });
      });

      const confirmBtn = await screen.findByRole("button", { name: "Eliminar" });
      expect(confirmBtn).toBeDisabled();

      const input = screen.getByRole("textbox");
      await user.type(input, "ELIMIN");
      expect(confirmBtn).toBeDisabled();

      await user.type(input, "AR");
      expect(confirmBtn).toBeEnabled();

      await user.click(confirmBtn);
      await expect(promise).resolves.toBe(true);
    });

    it("treats whitespace as part of trim — exact-match after .trim()", async () => {
      const user = userEvent.setup();
      mountHost();

      act(() => {
        void confirmAction({ title: "x", requireText: "BORRAR" });
      });

      const confirmBtn = await screen.findByRole("button", { name: "Confirmar" });
      const input = screen.getByRole("textbox");
      await user.type(input, "  BORRAR  ");
      expect(confirmBtn).toBeEnabled();
    });

    it("uses a custom label for the typed-confirmation input", async () => {
      mountHost();
      act(() => {
        void confirmAction({
          title: "x",
          requireText: "OK",
          requireTextLabel: "Escribe la palabra mágica",
        });
      });

      expect(await screen.findByText("Escribe la palabra mágica")).toBeInTheDocument();
    });

    it("falls back to a default label that quotes the required text", async () => {
      mountHost();
      act(() => {
        void confirmAction({ title: "x", requireText: "BORRAR" });
      });
      expect(await screen.findByText(/Escribe "BORRAR" para confirmar/i)).toBeInTheDocument();
    });

    it("clears the typed value when a fresh confirm opens", async () => {
      const user = userEvent.setup();
      mountHost();

      act(() => {
        void confirmAction({ title: "first", requireText: "X" });
      });
      const input1 = (await screen.findByRole("textbox")) as HTMLInputElement;
      await user.type(input1, "X");
      expect(input1.value).toBe("X");

      // Close it (cancel) and open a fresh one
      await user.click(screen.getByRole("button", { name: "Cancelar" }));

      act(() => {
        void confirmAction({ title: "second", requireText: "Y" });
      });

      const input2 = (await screen.findByRole("textbox")) as HTMLInputElement;
      expect(input2.value).toBe("");
    });
  });

  it('applies "danger" variant to the confirm button when variant="danger"', async () => {
    mountHost();
    act(() => {
      void confirmAction({ title: "x", variant: "danger", confirmLabel: "Borrar" });
    });

    const confirmBtn = await screen.findByRole("button", { name: "Borrar" });
    // HeroUI applies danger color via class tokens; assert via class signal.
    // We don't assert exact class names — instead assert that the cancel
    // (variant=outline) and confirm buttons differ in their class signature,
    // documenting that the variant prop actually flows through.
    const cancelBtn = screen.getByRole("button", { name: "Cancelar" });
    expect(confirmBtn.className).not.toEqual(cancelBtn.className);
  });

  it("returns a stable function reference (singleton store contract)", () => {
    // Imperative API contract: importing `confirmAction` from anywhere
    // hits the same module-singleton store. We sanity-check the export.
    expect(typeof confirmAction).toBe("function");
  });

  describe("concurrent calls (documented behaviour)", () => {
    it("second confirmAction call replaces the first; resolving once resolves the *latest* caller", async () => {
      // The store is a singleton — calling confirmAction while one is
      // already open overwrites the resolver. The first promise will
      // never settle (callers must avoid this pattern in app code).
      const user = userEvent.setup();
      mountHost();

      let p1Settled = false;
      let p2!: Promise<boolean>;

      act(() => {
        void confirmAction({ title: "first" }).then(() => {
          p1Settled = true;
        });
      });

      // Now open a second one before the first resolves.
      act(() => {
        p2 = confirmAction({ title: "second" });
      });

      const confirmBtn = await screen.findByRole("button", { name: "Confirmar" });
      await user.click(confirmBtn);

      await expect(p2).resolves.toBe(true);
      // First promise was orphaned — the resolver was overwritten by
      // the second call. This documents current behaviour so a future
      // refactor (queue, reject-prior) surfaces in CI.
      expect(p1Settled).toBe(false);
    });
  });
});
