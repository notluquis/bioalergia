/**
 * Tests for `usePushNotifications`.
 *
 * Covers the initial permission/subscription read on mount, the toggle path
 * (subscribe/unsubscribe), and the test-notification mutation. Heavy
 * Notification + ServiceWorker + PushManager APIs are stubbed at module
 * boundaries.
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const apiMocks = vi.hoisted(() => ({
  subscribeToNotifications: vi.fn().mockResolvedValue(undefined),
  unsubscribeFromNotifications: vi.fn().mockResolvedValue(undefined),
  sendTestNotification: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/features/notifications/api", () => apiMocks);

const toastMocks = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
}));
vi.mock("@/context/ToastContext", () => ({
  useToast: () => toastMocks,
}));

const authMocks = vi.hoisted(() => ({
  user: { id: "u1" } as { id: string } | null,
}));
vi.mock("@/context/AuthContext", () => ({
  useAuth: () => authMocks,
}));

import { usePushNotifications } from "./use-push-notifications";

function makeWrapper() {
  const client = new QueryClient({
    defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
  });
  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  }
  return { Wrapper };
}

interface PMSub {
  endpoint: string;
  unsubscribe: ReturnType<typeof vi.fn>;
}

interface FakePushManager {
  getSubscription: ReturnType<typeof vi.fn>;
  subscribe: ReturnType<typeof vi.fn>;
}

function installServiceWorker(opts: { sub?: PMSub | null } = {}) {
  const pushManager: FakePushManager = {
    getSubscription: vi.fn().mockResolvedValue(opts.sub ?? null),
    subscribe: vi.fn().mockResolvedValue({
      endpoint: "https://push.example/abc",
      toJSON: () => ({}),
    }),
  };
  const registration = { pushManager };
  Object.defineProperty(navigator, "serviceWorker", {
    configurable: true,
    value: { ready: Promise.resolve(registration) },
  });
  return { pushManager };
}

function installNotification(permission: NotificationPermission = "default") {
  class FakeNotification {
    static permission: NotificationPermission = permission;
    static requestPermission = vi.fn().mockResolvedValue("granted" as NotificationPermission);
  }
  (globalThis as { Notification?: unknown }).Notification =
    FakeNotification as unknown as typeof Notification;
  return FakeNotification;
}

beforeEach(() => {
  Object.values(apiMocks).forEach((m) => m.mockClear());
  Object.values(toastMocks).forEach((m) => m.mockClear());
  authMocks.user = { id: "u1" };
});

afterEach(() => {
  delete (globalThis as { Notification?: unknown }).Notification;
});

describe("usePushNotifications", () => {
  it("starts with permission 'default' and isSubscribed=false on first mount", async () => {
    installNotification("default");
    installServiceWorker({ sub: null });

    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => usePushNotifications(), { wrapper: Wrapper });

    await waitFor(() => {
      expect(result.current.permission).toBe("default");
    });
    await waitFor(() => {
      expect(result.current.isSubscribed).toBe(false);
    });
  });

  it("detects existing subscription on mount → isSubscribed=true", async () => {
    installNotification("granted");
    installServiceWorker({
      sub: {
        endpoint: "https://push.example/x",
        unsubscribe: vi.fn().mockResolvedValue(true),
      },
    });

    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => usePushNotifications(), { wrapper: Wrapper });

    await waitFor(() => {
      expect(result.current.isSubscribed).toBe(true);
    });
    expect(result.current.permission).toBe("granted");
  });

  it("toggleSubscription subscribes when not subscribed and permission granted", async () => {
    const N = installNotification("default");
    const { pushManager } = installServiceWorker({ sub: null });

    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => usePushNotifications(), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.permission).toBe("default"));

    await result.current.toggleSubscription();

    expect(N.requestPermission).toHaveBeenCalled();
    expect(pushManager.subscribe).toHaveBeenCalled();
    await waitFor(() => {
      expect(apiMocks.subscribeToNotifications).toHaveBeenCalled();
    });
  });

  it("toggleSubscription unsubscribes when already subscribed", async () => {
    installNotification("granted");
    const unsubscribe = vi.fn().mockResolvedValue(true);
    installServiceWorker({
      sub: { endpoint: "https://push.example/x", unsubscribe },
    });

    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => usePushNotifications(), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.isSubscribed).toBe(true));

    await result.current.toggleSubscription();
    expect(unsubscribe).toHaveBeenCalled();
    await waitFor(() => {
      expect(apiMocks.unsubscribeFromNotifications).toHaveBeenCalledWith({
        endpoint: "https://push.example/x",
      });
    });
  });

  it("sendTestNotification calls the API with the current user id", async () => {
    installNotification("granted");
    installServiceWorker({ sub: null });

    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => usePushNotifications(), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.permission).toBe("granted"));

    await result.current.sendTestNotification();
    await waitFor(() => {
      expect(apiMocks.sendTestNotification).toHaveBeenCalledWith({ userId: "u1" });
    });
  });

  it("sendTestNotification is a no-op when no user is logged in", async () => {
    installNotification("granted");
    installServiceWorker({ sub: null });
    authMocks.user = null;

    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => usePushNotifications(), { wrapper: Wrapper });

    await result.current.sendTestNotification();
    // Mutation runs but its mutationFn early-returns; API never called.
    await waitFor(() => {
      expect(apiMocks.sendTestNotification).not.toHaveBeenCalled();
    });
  });
});
