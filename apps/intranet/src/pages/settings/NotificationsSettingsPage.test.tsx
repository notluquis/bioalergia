/**
 * Tests for `NotificationsSettingsPage` — controls subscription state
 * and the preview-mode privacy setting.
 *
 * Covers:
 * - Subscribed banner + "Desactivar" CTA path.
 * - Unsubscribed banner + "Activar" CTA path.
 * - "Permission denied" warning when the browser blocked notifications.
 * - Preview-mode select is gated by subscription state.
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

beforeAll(() => {
  if (typeof globalThis.ResizeObserver === "undefined") {
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver;
  }
});

const pushState = vi.hoisted(() => ({
  isSubscribed: false as boolean,
  permission: "default" as NotificationPermission,
  toggleSubscription: vi.fn(),
}));

const apiMocks = vi.hoisted(() => ({
  getPushPreviewMode: vi.fn(),
  setPushPreviewMode: vi.fn(),
}));

vi.mock("@/hooks/use-push-notifications", () => ({
  usePushNotifications: () => pushState,
}));

vi.mock("@/features/notifications/api", () => ({
  getPushPreviewMode: apiMocks.getPushPreviewMode,
  setPushPreviewMode: apiMocks.setPushPreviewMode,
}));

const { NotificationsSettingsPage } = await import("./NotificationsSettingsPage");

function wrap(ui: ReactNode) {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

beforeEach(() => {
  pushState.isSubscribed = false;
  pushState.permission = "default";
  pushState.toggleSubscription.mockReset();
  apiMocks.getPushPreviewMode.mockReset();
  apiMocks.setPushPreviewMode.mockReset();
  apiMocks.getPushPreviewMode.mockResolvedValue({ mode: "GENERIC" });
});

describe("NotificationsSettingsPage", () => {
  it("shows the Activar CTA when not subscribed", async () => {
    wrap(<NotificationsSettingsPage />);
    expect(await screen.findByRole("button", { name: /^activar$/i })).toBeInTheDocument();
  });

  it("shows the Desactivar CTA when already subscribed", async () => {
    pushState.isSubscribed = true;
    wrap(<NotificationsSettingsPage />);
    expect(await screen.findByRole("button", { name: /desactivar/i })).toBeInTheDocument();
  });

  it("invokes toggleSubscription when the CTA is pressed", async () => {
    const user = userEvent.setup();
    wrap(<NotificationsSettingsPage />);
    await user.click(await screen.findByRole("button", { name: /^activar$/i }));
    expect(pushState.toggleSubscription).toHaveBeenCalled();
  });

  it("disables the toggle and shows a denied-permission warning when blocked", async () => {
    pushState.permission = "denied";
    wrap(<NotificationsSettingsPage />);

    expect(await screen.findByText(/El navegador bloqueó las notificaciones/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^activar$/i })).toBeDisabled();
  });

  it("disables the preview-mode select when the user is not subscribed", async () => {
    wrap(<NotificationsSettingsPage />);
    // Wait for the query to settle (effectively the button to render).
    await screen.findByRole("button", { name: /^activar$/i });
    // Select trigger inherits the disabled state — assert via aria.
    await waitFor(() => {
      const select = document.querySelector('[data-slot="select-trigger"]');
      expect(select).not.toBeNull();
      expect(select).toHaveAttribute("data-disabled", "true");
    });
  });
});
