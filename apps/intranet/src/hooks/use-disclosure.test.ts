import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { useDisclosure } from "./use-disclosure";

describe("useDisclosure", () => {
  it("starts closed by default", () => {
    const { result } = renderHook(() => useDisclosure());
    expect(result.current.isOpen).toBe(false);
  });

  it("starts open when initialState is true", () => {
    const { result } = renderHook(() => useDisclosure(true));
    expect(result.current.isOpen).toBe(true);
  });

  it("open() sets isOpen to true", () => {
    const { result } = renderHook(() => useDisclosure());
    act(() => {
      result.current.open();
    });
    expect(result.current.isOpen).toBe(true);
  });

  it("close() sets isOpen to false", () => {
    const { result } = renderHook(() => useDisclosure(true));
    act(() => {
      result.current.close();
    });
    expect(result.current.isOpen).toBe(false);
  });

  it("toggle() flips from false to true", () => {
    const { result } = renderHook(() => useDisclosure(false));
    act(() => {
      result.current.toggle();
    });
    expect(result.current.isOpen).toBe(true);
  });

  it("toggle() flips from true to false", () => {
    const { result } = renderHook(() => useDisclosure(true));
    act(() => {
      result.current.toggle();
    });
    expect(result.current.isOpen).toBe(false);
  });

  it("toggle() can be called multiple times", () => {
    const { result } = renderHook(() => useDisclosure());
    act(() => {
      result.current.toggle();
      result.current.toggle();
      result.current.toggle();
    });
    expect(result.current.isOpen).toBe(true);
  });

  it("set() with true opens when closed", () => {
    const { result } = renderHook(() => useDisclosure(false));
    act(() => {
      result.current.set(true);
    });
    expect(result.current.isOpen).toBe(true);
  });

  it("set() with false closes when open", () => {
    const { result } = renderHook(() => useDisclosure(true));
    act(() => {
      result.current.set(false);
    });
    expect(result.current.isOpen).toBe(false);
  });

  it("open() is idempotent", () => {
    const { result } = renderHook(() => useDisclosure(true));
    act(() => {
      result.current.open();
    });
    expect(result.current.isOpen).toBe(true);
  });

  it("close() is idempotent", () => {
    const { result } = renderHook(() => useDisclosure(false));
    act(() => {
      result.current.close();
    });
    expect(result.current.isOpen).toBe(false);
  });

  it("exposes all required controls", () => {
    const { result } = renderHook(() => useDisclosure());
    expect(typeof result.current.open).toBe("function");
    expect(typeof result.current.close).toBe("function");
    expect(typeof result.current.toggle).toBe("function");
    expect(typeof result.current.set).toBe("function");
  });
});
