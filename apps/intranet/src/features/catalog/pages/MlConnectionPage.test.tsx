/**
 * Tests for `MlConnectionPage` — MercadoLibre OAuth connect / disconnect
 * UX and OAuth-callback querystring handling.
 *
 * Mocks at module boundaries: `../orpc-ml` (status/connect/disconnect),
 * confirmAction, useToast. `window.location` is replaced to capture the
 * authorization-URL redirect.
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mlMocks = vi.hoisted(() => ({
  status: vi.fn(),
  connect: vi.fn(),
  disconnect: vi.fn(),
}));

const toastMocks = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
}));

const confirmActionMock = vi.hoisted(() => vi.fn<() => Promise<boolean>>());

vi.mock("../orpc-ml", () => ({
  mlORPCClient: mlMocks,
}));

vi.mock("@/context/ToastContext", () => ({
  useToast: () => toastMocks,
}));

vi.mock("@/components/ui/ConfirmDialog", () => ({
  confirmAction: confirmActionMock,
}));

const { MlConnectionPage } = await import("./MlConnectionPage");

function buildWrapper() {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

describe("MlConnectionPage", () => {
  let originalLocation: Location;
  let hrefSetter: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    originalLocation = window.location;
    hrefSetter = vi.fn();
    // Replace location with a writable shim.
    Object.defineProperty(window, "location", {
      configurable: true,
      value: {
        get href() {
          return "http://localhost/ml";
        },
        set href(v: string) {
          hrefSetter(v);
        },
        pathname: "/ml",
        search: "",
        origin: "http://localhost",
      },
    });
    window.history.replaceState = vi.fn();
  });

  afterEach(() => {
    Object.defineProperty(window, "location", {
      configurable: true,
      value: originalLocation,
    });
  });

  it("shows loading spinner while status query pending", async () => {
    mlMocks.status.mockReturnValue(new Promise(() => undefined));
    const Wrapper = buildWrapper();
    render(
      <Wrapper>
        <MlConnectionPage />
      </Wrapper>
    );
    expect(await screen.findByText(/Cargando estado/i)).toBeInTheDocument();
  });

  it("renders disconnected state with warning Alert and primary Connect button", async () => {
    mlMocks.status.mockResolvedValue({ data: { connected: false } });
    const Wrapper = buildWrapper();
    render(
      <Wrapper>
        <MlConnectionPage />
      </Wrapper>
    );

    expect(await screen.findByText(/Sin cuenta conectada/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Conectar MercadoLibre/i })).toBeInTheDocument();
  });

  it("renders connected state with Seller ID + Reconnect + Disconnect buttons", async () => {
    mlMocks.status.mockResolvedValue({
      data: {
        connected: true,
        ml_user_id: "12345",
        expires_at: new Date("2026-12-31T00:00:00Z"),
        scope: "offline_access write",
      },
    });
    const Wrapper = buildWrapper();
    render(
      <Wrapper>
        <MlConnectionPage />
      </Wrapper>
    );

    expect(await screen.findByText(/Conectado/)).toBeInTheDocument();
    expect(screen.getByText("12345")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Reconectar/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Desconectar/i })).toBeInTheDocument();
  });

  it("connect button → calls mutation → redirects to authorization_url", async () => {
    const user = userEvent.setup();
    mlMocks.status.mockResolvedValue({ data: { connected: false } });
    mlMocks.connect.mockResolvedValue({
      data: { authorization_url: "https://auth.mercadolibre.com/authorization?xyz" },
    });

    const Wrapper = buildWrapper();
    render(
      <Wrapper>
        <MlConnectionPage />
      </Wrapper>
    );

    const btn = await screen.findByRole("button", { name: /Conectar MercadoLibre/i });
    await user.click(btn);

    await waitFor(() => expect(mlMocks.connect).toHaveBeenCalled());
    await waitFor(() =>
      expect(hrefSetter).toHaveBeenCalledWith("https://auth.mercadolibre.com/authorization?xyz")
    );
  });

  it("disconnect → confirms via confirmAction → on cancel does not disconnect", async () => {
    const user = userEvent.setup();
    mlMocks.status.mockResolvedValue({
      data: {
        connected: true,
        ml_user_id: "1",
        expires_at: new Date("2026-01-01T00:00:00Z"),
        scope: null,
      },
    });
    confirmActionMock.mockResolvedValue(false);

    const Wrapper = buildWrapper();
    render(
      <Wrapper>
        <MlConnectionPage />
      </Wrapper>
    );
    const btn = await screen.findByRole("button", { name: /Desconectar/i });
    await user.click(btn);

    await waitFor(() => expect(confirmActionMock).toHaveBeenCalled());
    expect(mlMocks.disconnect).not.toHaveBeenCalled();
  });

  it("disconnect → confirms → fires disconnect → toastSuccess", async () => {
    const user = userEvent.setup();
    mlMocks.status.mockResolvedValue({
      data: {
        connected: true,
        ml_user_id: "1",
        expires_at: new Date("2026-01-01T00:00:00Z"),
        scope: null,
      },
    });
    confirmActionMock.mockResolvedValue(true);
    mlMocks.disconnect.mockResolvedValue({ data: { ok: true } });

    const Wrapper = buildWrapper();
    render(
      <Wrapper>
        <MlConnectionPage />
      </Wrapper>
    );
    const btn = await screen.findByRole("button", { name: /Desconectar/i });
    await user.click(btn);

    await waitFor(() => expect(mlMocks.disconnect).toHaveBeenCalled());
    await waitFor(() =>
      expect(toastMocks.success).toHaveBeenCalledWith("MercadoLibre desconectado")
    );
  });

  it("connect mutation error → toastError", async () => {
    const user = userEvent.setup();
    mlMocks.status.mockResolvedValue({ data: { connected: false } });
    mlMocks.connect.mockRejectedValue(new Error("OAuth misconfigured"));

    const Wrapper = buildWrapper();
    render(
      <Wrapper>
        <MlConnectionPage />
      </Wrapper>
    );
    const btn = await screen.findByRole("button", { name: /Conectar MercadoLibre/i });
    await user.click(btn);

    await waitFor(() => expect(toastMocks.error).toHaveBeenCalledWith("OAuth misconfigured"));
  });

  it("?ml_connected=1 in URL → toastSuccess + clear querystring", async () => {
    mlMocks.status.mockResolvedValue({ data: { connected: false } });
    Object.defineProperty(window, "location", {
      configurable: true,
      value: {
        ...window.location,
        search: "?ml_connected=1",
        pathname: "/ml",
      },
    });
    const Wrapper = buildWrapper();
    render(
      <Wrapper>
        <MlConnectionPage />
      </Wrapper>
    );

    await waitFor(() =>
      expect(toastMocks.success).toHaveBeenCalledWith("MercadoLibre conectado correctamente")
    );
    expect(window.history.replaceState).toHaveBeenCalled();
  });

  it("?ml_error=denied in URL → toastError + clear querystring", async () => {
    mlMocks.status.mockResolvedValue({ data: { connected: false } });
    Object.defineProperty(window, "location", {
      configurable: true,
      value: {
        ...window.location,
        search: "?ml_error=denied",
        pathname: "/ml",
      },
    });
    const Wrapper = buildWrapper();
    render(
      <Wrapper>
        <MlConnectionPage />
      </Wrapper>
    );

    await waitFor(() =>
      expect(toastMocks.error).toHaveBeenCalledWith(expect.stringContaining("denied"))
    );
  });
});
