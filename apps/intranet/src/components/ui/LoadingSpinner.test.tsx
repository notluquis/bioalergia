/**
 * Tests for `LoadingSpinner` — A11y-correct wrapper around HeroUI Spinner.
 */
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { LoadingSpinner } from "./LoadingSpinner";

describe("LoadingSpinner", () => {
  it("renders a status region (role=status) for screen readers", () => {
    render(<LoadingSpinner />);
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("default sr-only label is 'Cargando'", () => {
    render(<LoadingSpinner />);
    expect(screen.getByText("Cargando")).toBeInTheDocument();
  });

  it("uses a custom label when provided", () => {
    render(<LoadingSpinner label="Guardando cambios" />);
    expect(screen.getByText("Guardando cambios")).toBeInTheDocument();
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("status region has aria-live=polite for non-interrupting announcements", () => {
    render(<LoadingSpinner />);
    const status = screen.getByRole("status");
    expect(status).toHaveAttribute("aria-live", "polite");
  });

  it("the label is visually hidden (sr-only) but accessible to AT", () => {
    render(<LoadingSpinner label="X" />);
    const label = screen.getByText("X");
    expect(label.className).toContain("sr-only");
  });
});
