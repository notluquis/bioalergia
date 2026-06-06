/**
 * Tests for `_shared` helpers: `StatusTicks`, `dayLabel`, `initialsOf`,
 * and the `QUICK_REACTIONS` constant. Focus on a11y (every status icon
 * carries an aria-label) and pure-function determinism.
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { addDays, formatChile, today } from "@/lib/dates";
import { dayLabel, initialsOf, QUICK_REACTIONS, StatusTicks } from "./_shared";

describe("StatusTicks (a11y)", () => {
  it("renders aria-label='enviando' for PENDING", () => {
    render(<StatusTicks status="PENDING" />);
    expect(screen.getByLabelText("enviando")).toBeInTheDocument();
  });

  it("renders aria-label='falló' for FAILED", () => {
    render(<StatusTicks status="FAILED" />);
    expect(screen.getByLabelText("falló")).toBeInTheDocument();
  });

  it("renders aria-label='leído' for READ", () => {
    render(<StatusTicks status="READ" />);
    expect(screen.getByLabelText("leído")).toBeInTheDocument();
  });

  it("renders aria-label='entregado' for DELIVERED", () => {
    render(<StatusTicks status="DELIVERED" />);
    expect(screen.getByLabelText("entregado")).toBeInTheDocument();
  });

  it("renders aria-label='enviado' for SENT (default)", () => {
    render(<StatusTicks status="SENT" />);
    expect(screen.getByLabelText("enviado")).toBeInTheDocument();
  });
});

describe("dayLabel", () => {
  it("returns 'Hoy' for today", () => {
    expect(dayLabel(new Date())).toBe("Hoy");
  });

  it("returns 'Ayer' for yesterday", () => {
    expect(dayLabel(addDays(today(), -1))).toBe("Ayer");
  });

  it("returns the weekday name within last 7 days", () => {
    const threeDaysAgo = addDays(today(), -3);
    expect(dayLabel(threeDaysAgo)).toBe(formatChile(threeDaysAgo, "dddd"));
  });

  it("returns DD MMM YYYY for older dates", () => {
    const old = addDays(today(), -30);
    expect(dayLabel(old)).toBe(formatChile(old, "DD MMM YYYY"));
  });
});

describe("initialsOf", () => {
  it("returns '?' for empty string", () => {
    expect(initialsOf("")).toBe("?");
    expect(initialsOf("   ")).toBe("?");
  });

  it("returns first two upper-cased chars for single-word names", () => {
    expect(initialsOf("ana")).toBe("AN");
  });

  it("returns first+last initial for multi-word names", () => {
    expect(initialsOf("Ana Lucia Perez Soto")).toBe("AS");
  });

  it("handles multiple spaces", () => {
    expect(initialsOf("  Ana   Perez  ")).toBe("AP");
  });
});

describe("QUICK_REACTIONS", () => {
  it("exposes the documented emoji set", () => {
    expect(QUICK_REACTIONS).toEqual(["👍", "❤️", "😂", "😮", "😢", "🙏"]);
  });
});
