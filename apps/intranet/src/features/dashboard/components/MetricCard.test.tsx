/**
 * Tests for `MetricCard` — the headline KPI tile on the dashboard.
 *
 * Why this exists: the accent-color → badge-label coupling is a known
 * footgun (a rose-tinted "Neto" card would default to "Egresos"
 * without an explicit override). The "honours explicit badgeLabel"
 * test below is the canary for that regression.
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { MetricCard } from "./MetricCard";

describe("MetricCard", () => {
  it("renders the title and formatted CLP value", () => {
    render(<MetricCard accent="primary" loading={false} title="Mensual Neto" value={123_456} />);
    expect(screen.getByRole("heading", { name: "Mensual Neto" })).toBeInTheDocument();
    // fmtCLP produces a string like "$123.456" — assert the digits show
    // up regardless of exact glyph (NBSP, etc.).
    expect(screen.getByText(/123\.456|123 456|123,456/)).toBeInTheDocument();
  });

  it('shows "—" while loading instead of the value', () => {
    render(<MetricCard accent="primary" loading={true} title="Resultado" value={999} />);
    expect(screen.getByText("—")).toBeInTheDocument();
    expect(screen.queryByText(/999/)).not.toBeInTheDocument();
  });

  it.each([
    ["emerald", "Ingresos"],
    ["primary", "Resultado"],
    ["rose", "Egresos"],
  ] as const)("derives the default badge from accent=%s → %s", (accent, expected) => {
    render(<MetricCard accent={accent} loading={false} title="x" value={0} />);
    expect(screen.getByText(expected)).toBeInTheDocument();
  });

  it("honours an explicit badgeLabel (overrides the accent default)", () => {
    render(
      <MetricCard accent="rose" badgeLabel="Neto" loading={false} title="Saldo" value={-100} />
    );
    expect(screen.getByText("Neto")).toBeInTheDocument();
    expect(screen.queryByText("Egresos")).not.toBeInTheDocument();
  });
});
