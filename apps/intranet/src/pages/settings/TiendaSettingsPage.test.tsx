/**
 * Tests for `TiendaSettingsPage` — small storefront settings form.
 *
 * Covers loading state, save success, and save error paths. Mocks
 * `useSettings` at the module boundary so we don't need a live
 * QueryClient + API stack.
 */

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const settingsState = vi.hoisted(() => ({
  loading: false as boolean,
  settings: { shopLowStockThreshold: "3" } as Record<string, string>,
  updateSettings: vi.fn(),
}));

const toastMocks = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
}));

vi.mock("@/features/settings/hooks/use-settings", () => ({
  useSettings: () => ({
    loading: settingsState.loading,
    settings: settingsState.settings,
    updateSettings: settingsState.updateSettings,
  }),
}));

vi.mock("@/context/ToastContext", () => ({
  useToast: () => toastMocks,
}));

const { TiendaSettingsPage } = await import("./TiendaSettingsPage");

beforeEach(() => {
  settingsState.loading = false;
  settingsState.settings = { shopLowStockThreshold: "3" };
  settingsState.updateSettings.mockReset();
  for (const fn of Object.values(toastMocks)) fn.mockReset();
});

describe("TiendaSettingsPage", () => {
  it("renders a loading message while settings are loading", () => {
    settingsState.loading = true;
    render(<TiendaSettingsPage />);
    expect(screen.getByText(/cargando/i)).toBeInTheDocument();
  });

  it("renders the heading and the threshold field with the persisted value", () => {
    render(<TiendaSettingsPage />);
    expect(screen.getByText(/Configuración de la tienda/i)).toBeInTheDocument();
    // HeroUI NumberField wraps an Input; role is "textbox" with a
    // numeric inputMode, and the value is rendered as a string.
    expect(screen.getByRole("textbox")).toHaveValue("3");
  });

  it("posts the new threshold and surfaces a success toast", async () => {
    settingsState.updateSettings.mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<TiendaSettingsPage />);

    await user.click(screen.getByRole("button", { name: /guardar/i }));

    await waitFor(() =>
      expect(settingsState.updateSettings).toHaveBeenCalledWith(
        expect.objectContaining({ shopLowStockThreshold: "3" })
      )
    );
    await waitFor(() => expect(toastMocks.success).toHaveBeenCalledWith("Configuración guardada"));
  });

  it("surfaces an error toast when updateSettings rejects", async () => {
    settingsState.updateSettings.mockRejectedValue(new Error("Server error"));
    const user = userEvent.setup();
    render(<TiendaSettingsPage />);

    await user.click(screen.getByRole("button", { name: /guardar/i }));

    await waitFor(() => expect(toastMocks.error).toHaveBeenCalledWith("Server error"));
  });
});
