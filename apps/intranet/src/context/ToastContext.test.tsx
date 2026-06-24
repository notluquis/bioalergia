/**
 * Tests for the legacy `useToast` API — maps function-style calls to the
 * underlying toast-interceptor (success/error/info).
 */
import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const toastMock = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
}));
vi.mock("@/lib/toast-interceptor", () => ({ toast: toastMock }));

import { useToast } from "./ToastContext";

beforeEach(() => {
  toastMock.success.mockClear();
  toastMock.error.mockClear();
  toastMock.info.mockClear();
});

describe("useToast (legacy)", () => {
  it("success(message) defaults title to 'Éxito'", () => {
    const { result } = renderHook(() => useToast());
    result.current.success("Listo");
    expect(toastMock.success).toHaveBeenCalledWith("Listo", { description: "Éxito" });
  });

  it("success(message, customTitle) forwards the custom title", () => {
    const { result } = renderHook(() => useToast());
    result.current.success("Listo", "Guardado");
    expect(toastMock.success).toHaveBeenCalledWith("Listo", { description: "Guardado" });
  });

  it("info(message) defaults title to 'Información'", () => {
    const { result } = renderHook(() => useToast());
    result.current.info("FYI");
    expect(toastMock.info).toHaveBeenCalledWith("FYI", { description: "Información" });
  });

  describe("error()", () => {
    it("handles plain string messages", () => {
      const { result } = renderHook(() => useToast());
      result.current.error("Boom");
      expect(toastMock.error).toHaveBeenCalledWith("Boom", { description: "Error" });
    });

    it("extracts .message from Error instances", () => {
      const { result } = renderHook(() => useToast());
      result.current.error(new Error("Falló X"));
      expect(toastMock.error).toHaveBeenCalledWith("Falló X", { description: "Error" });
    });

    it("stringifies non-Error / non-string values", () => {
      const { result } = renderHook(() => useToast());
      result.current.error({ status: 500 });
      expect(toastMock.error).toHaveBeenCalledWith(expect.stringContaining("object"), {
        description: "Error",
      });
    });

    it("uses the provided custom title", () => {
      const { result } = renderHook(() => useToast());
      result.current.error("X", "Falla crítica");
      expect(toastMock.error).toHaveBeenCalledWith("X", { description: "Falla crítica" });
    });
  });
});
