/**
 * Tests for `FeatureErrorBoundary` — granular per-feature error boundary
 * with retry + optional close action.
 */
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const loggerMock = vi.hoisted(() => ({
  error: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  debug: vi.fn(),
}));
vi.mock("@/lib/logger", () => ({ logger: loggerMock }));

import { FeatureErrorBoundary } from "./FeatureErrorBoundary";

function Boom({ message = "boom" }: { message?: string }): never {
  throw new Error(message);
}

beforeEach(() => {
  Object.values(loggerMock).forEach((m) => m.mockClear());
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

describe("FeatureErrorBoundary", () => {
  it("renders children on the happy path", () => {
    render(
      <FeatureErrorBoundary featureName="X">
        <p>healthy</p>
      </FeatureErrorBoundary>
    );
    expect(screen.getByText("healthy")).toBeInTheDocument();
  });

  it("renders the fallback with the feature name when a child throws", () => {
    render(
      <FeatureErrorBoundary featureName="MiWizard">
        <Boom />
      </FeatureErrorBoundary>
    );
    expect(screen.getByText(/Algo salió mal en MiWizard/)).toBeInTheDocument();
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it("fallback exposes a Reintentar button", () => {
    render(
      <FeatureErrorBoundary featureName="X">
        <Boom />
      </FeatureErrorBoundary>
    );
    expect(screen.getByRole("button", { name: /Reintentar/ })).toBeInTheDocument();
  });

  it("renders an optional Cerrar button when onClose is provided + invokes it on click", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <FeatureErrorBoundary featureName="X" onClose={onClose}>
        <Boom />
      </FeatureErrorBoundary>
    );
    const btn = screen.getByRole("button", { name: "Cerrar" });
    await user.click(btn);
    expect(onClose).toHaveBeenCalled();
  });

  it("logs the captured error through the shared logger with the feature tag", () => {
    render(
      <FeatureErrorBoundary featureName="MiFeature">
        <Boom message="kaboom" />
      </FeatureErrorBoundary>
    );
    expect(loggerMock.error).toHaveBeenCalledWith(
      "[FeatureErrorBoundary:MiFeature]",
      expect.objectContaining({
        feature: "MiFeature",
        error: expect.any(Error),
      })
    );
  });

  it("resetKey change re-mounts children so the boundary can re-render after a fix", async () => {
    function Toggle() {
      const [key, setKey] = useState(0);
      return (
        <>
          <button onClick={() => setKey((k) => k + 1)}>bump</button>
          <FeatureErrorBoundary featureName="X" resetKey={key}>
            {key === 0 ? <Boom /> : <p>recovered</p>}
          </FeatureErrorBoundary>
        </>
      );
    }
    const user = userEvent.setup();
    render(<Toggle />);
    expect(screen.getByText(/Algo salió mal/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "bump" }));
    expect(screen.getByText("recovered")).toBeInTheDocument();
  });

  it("exposes error details in a collapsible <details> region", () => {
    render(
      <FeatureErrorBoundary featureName="X">
        <Boom message="ultra-specific" />
      </FeatureErrorBoundary>
    );
    expect(screen.getByText(/Detalles técnicos/)).toBeInTheDocument();
    expect(screen.getByText(/ultra-specific/)).toBeInTheDocument();
  });
});
