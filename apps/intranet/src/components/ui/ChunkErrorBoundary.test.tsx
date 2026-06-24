/**
 * Tests for `ChunkErrorBoundary` — react-error-boundary wrapper that
 * surfaces chunk load failures through the global app-recovery channel.
 */
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const signalAppFallbackMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/app-recovery", () => ({ signalAppFallback: signalAppFallbackMock }));

import { ChunkErrorBoundary } from "./ChunkErrorBoundary";

function Boom({ message }: { message: string }): never {
  throw new Error(message);
}

beforeEach(() => {
  signalAppFallbackMock.mockClear();
  // Silence React error boundary noise in test output.
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

describe("ChunkErrorBoundary", () => {
  it("renders children when no error is thrown", () => {
    render(
      <ChunkErrorBoundary>
        <p>healthy</p>
      </ChunkErrorBoundary>
    );
    expect(screen.getByText("healthy")).toBeInTheDocument();
    expect(signalAppFallbackMock).not.toHaveBeenCalled();
  });

  it("signals chunk fallback for 'Failed to fetch dynamically imported module'", () => {
    render(
      <ChunkErrorBoundary>
        <Boom message="Failed to fetch dynamically imported module: /assets/x.js" />
      </ChunkErrorBoundary>
    );
    expect(signalAppFallbackMock).toHaveBeenCalledWith("chunk");
  });

  it("signals chunk fallback for 'Importing a module script failed'", () => {
    render(
      <ChunkErrorBoundary>
        <Boom message="Importing a module script failed" />
      </ChunkErrorBoundary>
    );
    expect(signalAppFallbackMock).toHaveBeenCalledWith("chunk");
  });

  it("does NOT signal for unrelated errors", () => {
    render(
      <ChunkErrorBoundary>
        <Boom message="Cannot read properties of undefined" />
      </ChunkErrorBoundary>
    );
    expect(signalAppFallbackMock).not.toHaveBeenCalled();
  });

  it("renders null fallback (silent boundary)", () => {
    const { container } = render(
      <ChunkErrorBoundary>
        <Boom message="x" />
      </ChunkErrorBoundary>
    );
    expect(container).toBeEmptyDOMElement();
  });
});
