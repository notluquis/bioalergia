/**
 * Tests for `_shared` helpers: `StatusTicks`, `dayLabel`, `initialsOf`,
 * and the `QUICK_REACTIONS` constant. Focus on a11y (every status icon
 * carries an aria-label) and pure-function determinism.
 */

import { render, screen } from "@testing-library/react";
import dayjs from "dayjs";
import { describe, expect, it } from "vitest";
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
    expect(dayLabel(dayjs())).toBe("Hoy");
  });

  it("returns 'Ayer' for yesterday", () => {
    expect(dayLabel(dayjs().subtract(1, "day"))).toBe("Ayer");
  });

  it("returns the weekday name within last 7 days", () => {
    const threeDaysAgo = dayjs().subtract(3, "day");
    expect(dayLabel(threeDaysAgo)).toBe(threeDaysAgo.format("dddd"));
  });

  it("returns DD MMM YYYY for older dates", () => {
    const old = dayjs().subtract(30, "day");
    expect(dayLabel(old)).toBe(old.format("DD MMM YYYY"));
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
