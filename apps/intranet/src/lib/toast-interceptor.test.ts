/**
 * Tests for `toast-interceptor` — wraps HeroUI toast + persists every
 * notification into the local notification store.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const heroToastMock = vi.hoisted(() => ({
  success: vi.fn(() => "id-success"),
  danger: vi.fn(() => "id-danger"),
  info: vi.fn(() => "id-info"),
  warning: vi.fn(() => "id-warning"),
  promise: vi.fn(() => "id-promise"),
  clear: vi.fn(),
  default: vi.fn(() => "id-default"),
}));

vi.mock("@heroui/react", () => {
  // Default-callable toast (mirrors HeroUI export: `toast(...)` works).
  const fn = Object.assign(heroToastMock.default, heroToastMock);
  return { toast: fn };
});

const addNotificationMock = vi.hoisted(() => vi.fn());
vi.mock("@/features/notifications/store/use-notification-store", () => ({
  addNotification: addNotificationMock,
}));

import { toast } from "./toast-interceptor";

beforeEach(() => {
  addNotificationMock.mockClear();
  for (const v of Object.values(heroToastMock)) {
    if (typeof v === "function") (v as ReturnType<typeof vi.fn>).mockClear();
  }
});

describe("toast.success", () => {
  it("persists a success notification with default 'Éxito' title", () => {
    toast.success("Listo");
    expect(addNotificationMock).toHaveBeenCalledWith({
      type: "success",
      message: "Listo",
      title: "Éxito",
    });
    expect(heroToastMock.success).toHaveBeenCalledWith("Listo", undefined);
  });

  it("uses options.description as the notification title when present", () => {
    toast.success("Listo", { description: "Guardado" });
    expect(addNotificationMock).toHaveBeenCalledWith({
      type: "success",
      message: "Listo",
      title: "Guardado",
    });
  });
});

describe("toast.error / .info / .warning / .message", () => {
  it("maps error → danger UI variant + 'error' notification type", () => {
    toast.error("Falló");
    expect(addNotificationMock).toHaveBeenCalledWith({
      type: "error",
      message: "Falló",
      title: "Error",
    });
    expect(heroToastMock.danger).toHaveBeenCalled();
  });

  it("info uses heroToast.info", () => {
    toast.info("FYI");
    expect(addNotificationMock).toHaveBeenCalledWith({
      type: "info",
      message: "FYI",
      title: "Información",
    });
    expect(heroToastMock.info).toHaveBeenCalled();
  });

  it("warning uses heroToast.warning + 'warning' notification type", () => {
    toast.warning("Cuidado");
    expect(addNotificationMock).toHaveBeenCalledWith({
      type: "warning",
      message: "Cuidado",
      title: "Advertencia",
    });
    expect(heroToastMock.warning).toHaveBeenCalled();
  });

  it("message uses callable default toast", () => {
    toast.message("Hola");
    expect(addNotificationMock).toHaveBeenCalledWith({
      type: "info",
      message: "Hola",
      title: "Información",
    });
    expect(heroToastMock.default).toHaveBeenCalledWith("Hola", undefined);
  });
});

describe("toast.loading", () => {
  it("forwards isLoading: true + timeout: 0 to the underlying toast", () => {
    toast.loading("Cargando…");
    expect(heroToastMock.default).toHaveBeenCalledWith(
      "Cargando…",
      expect.objectContaining({ isLoading: true, timeout: 0 })
    );
    expect(addNotificationMock).toHaveBeenCalledWith({
      type: "info",
      message: "Cargando…",
      title: "En progreso",
    });
  });
});

describe("toast.promise", () => {
  it("persists 'loading' + 'success' notifications when the promise resolves", async () => {
    const promise = Promise.resolve({ ok: true });
    toast.promise(promise, {
      loading: "Procesando",
      success: () => "Done",
      error: () => "Failed",
    });

    await promise;
    // Microtask drain
    await Promise.resolve();
    await Promise.resolve();

    expect(addNotificationMock).toHaveBeenCalledWith(
      expect.objectContaining({ type: "info", message: "Procesando" })
    );
    expect(addNotificationMock).toHaveBeenCalledWith(
      expect.objectContaining({ type: "success", message: "Done" })
    );
    expect(heroToastMock.promise).toHaveBeenCalledTimes(1);
  });

  it("persists 'error' notification when the promise rejects", async () => {
    const err = new Error("boom");
    const promise = Promise.reject(err);
    toast.promise(promise, {
      loading: "x",
      success: "ok",
      error: (e: unknown) => (e instanceof Error ? e.message : "x"),
    });
    await promise.catch(() => undefined);
    await Promise.resolve();
    await Promise.resolve();

    expect(addNotificationMock).toHaveBeenCalledWith(
      expect.objectContaining({ type: "error", message: "boom" })
    );
  });

  it("invokes a function-form promise once (does not call twice)", async () => {
    const factory = vi.fn(async () => "x");
    toast.promise(factory, { loading: "l", success: "s", error: "e" });
    await Promise.resolve();
    await Promise.resolve();
    expect(factory).toHaveBeenCalledTimes(1);
  });
});

describe("toast.dismiss", () => {
  it("delegates to heroToast.clear", () => {
    toast.dismiss();
    expect(heroToastMock.clear).toHaveBeenCalled();
  });
});
