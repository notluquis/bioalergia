import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildTimesheetEmailComposition,
  escapeHtml,
  formatClp,
  formatDisplayDate,
  formatRetentionPercent,
  formatWorkedTime,
  type TimesheetEmailCompositionInput,
} from "../timesheet-email-template.ts";

// ─── formatClp ──────────────────────────────────────────────────────────────
// Chilean peso: "$" prefix, "." thousands separator, no decimals (rounded).

describe("formatClp", () => {
  it("formats a large amount with dot thousands separators", () => {
    expect(formatClp(1234567)).toBe("$1.234.567");
  });

  it("formats zero", () => {
    expect(formatClp(0)).toBe("$0");
  });

  it("formats a negative amount (sign after the currency symbol)", () => {
    expect(formatClp(-5000)).toBe("$-5.000");
  });

  it("rounds decimals up at .5+", () => {
    expect(formatClp(1234.56)).toBe("$1.235");
    expect(formatClp(1500.5)).toBe("$1.501");
  });

  it("rounds decimals down below .5", () => {
    expect(formatClp(1234.4)).toBe("$1.234");
  });

  it("formats a small integer with no separator", () => {
    expect(formatClp(999)).toBe("$999");
  });

  it("inserts separator at exactly 1000", () => {
    expect(formatClp(1000)).toBe("$1.000");
  });
});

// ─── escapeHtml ───────────────────────────────────────────────────────────────

describe("escapeHtml", () => {
  it("escapes ampersand", () => {
    expect(escapeHtml("a & b")).toBe("a &amp; b");
  });

  it("escapes less-than", () => {
    expect(escapeHtml("a < b")).toBe("a &lt; b");
  });

  it("escapes greater-than", () => {
    expect(escapeHtml("a > b")).toBe("a &gt; b");
  });

  it("escapes double quote", () => {
    expect(escapeHtml('say "hi"')).toBe("say &quot;hi&quot;");
  });

  it("escapes single quote to numeric entity", () => {
    expect(escapeHtml("it's")).toBe("it&#39;s");
  });

  it("escapes all special chars together in order", () => {
    expect(escapeHtml(`& < > " '`)).toBe("&amp; &lt; &gt; &quot; &#39;");
  });

  it("escapes ampersand first so entities are not double-escaped", () => {
    // If "<" were escaped before "&", the resulting "&lt;" would become
    // "&amp;lt;". Correct order escapes "&" first.
    expect(escapeHtml("<")).toBe("&lt;");
    expect(escapeHtml("&lt;")).toBe("&amp;lt;");
  });

  it("escapes every occurrence, not just the first", () => {
    expect(escapeHtml("a&b&c")).toBe("a&amp;b&amp;c");
  });

  it("leaves a plain string unchanged", () => {
    expect(escapeHtml("María José 123")).toBe("María José 123");
  });

  it("returns empty string for empty input", () => {
    expect(escapeHtml("")).toBe("");
  });
});

// ─── formatWorkedTime ─────────────────────────────────────────────────────────
// Format: "HH:MM", zero-padded to 2 digits each, hours can exceed 2 digits.

describe("formatWorkedTime", () => {
  it("formats zero minutes", () => {
    expect(formatWorkedTime(0)).toBe("00:00");
  });

  it("formats 90 minutes as 1h30", () => {
    expect(formatWorkedTime(90)).toBe("01:30");
  });

  it("formats an exact hour boundary", () => {
    expect(formatWorkedTime(60)).toBe("01:00");
  });

  it("zero-pads single-digit minutes", () => {
    expect(formatWorkedTime(605)).toBe("10:05");
  });

  it("zero-pads minutes under ten with zero hours", () => {
    expect(formatWorkedTime(5)).toBe("00:05");
  });

  it("does not truncate hours beyond two digits", () => {
    expect(formatWorkedTime(9600)).toBe("160:00");
  });

  it("handles 59 minutes (just below the hour rollover)", () => {
    expect(formatWorkedTime(59)).toBe("00:59");
  });
});

// ─── formatRetentionPercent ───────────────────────────────────────────────────
// rate * 100, es-CL number format (comma decimal), max 2 fraction digits, "%" suffix.

describe("formatRetentionPercent", () => {
  it("formats a typical retention rate", () => {
    expect(formatRetentionPercent(0.1275)).toBe("12,75%");
  });

  it("formats 0.1 as 10%", () => {
    expect(formatRetentionPercent(0.1)).toBe("10%");
  });

  it("formats zero", () => {
    expect(formatRetentionPercent(0)).toBe("0%");
  });

  it("formats a full rate as 100%", () => {
    expect(formatRetentionPercent(1)).toBe("100%");
  });

  it("uses a comma as the decimal separator", () => {
    expect(formatRetentionPercent(0.127)).toBe("12,7%");
  });

  it("caps at two fraction digits", () => {
    // 0.123456 * 100 = 12.3456 -> rounds to 12,35
    expect(formatRetentionPercent(0.123456)).toBe("12,35%");
  });
});

// ─── formatDisplayDate ────────────────────────────────────────────────────────
// ISO yyyy-mm-dd -> dd-mm-yyyy; anything else passes through unchanged.

describe("formatDisplayDate", () => {
  it("reorders an ISO date to day-month-year", () => {
    expect(formatDisplayDate("2026-05-15")).toBe("15-05-2026");
  });

  it("preserves zero-padded components", () => {
    expect(formatDisplayDate("2026-01-09")).toBe("09-01-2026");
  });

  it("returns a non-ISO string unchanged", () => {
    expect(formatDisplayDate("not a date")).toBe("not a date");
  });

  it("returns a partial/invalid-shaped date unchanged", () => {
    expect(formatDisplayDate("2026-5-1")).toBe("2026-5-1");
  });

  it("returns an empty string unchanged", () => {
    expect(formatDisplayDate("")).toBe("");
  });
});

// ─── buildTimesheetEmailComposition ───────────────────────────────────────────

function makeInput(
  overrides: Partial<TimesheetEmailCompositionInput> = {}
): TimesheetEmailCompositionInput {
  return {
    employeeName: "María José",
    monthLabel: "Mayo 2026",
    summary: {
      net: 873000,
      subtotal: 1000000,
      retention: 127000,
      payDate: "2026-06-05",
      role: "Enfermera",
      workedMinutes: 9000,
      overtimeMinutes: 600,
      retentionRate: 0.127,
    },
    ...overrides,
  };
}

describe("buildTimesheetEmailComposition", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 4, 15, 12, 0, 0));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns html, subject and text", () => {
    const result = buildTimesheetEmailComposition(makeInput());
    expect(Object.keys(result).sort()).toEqual(["html", "subject", "text"]);
  });

  it("builds the subject with month label and employee name", () => {
    const result = buildTimesheetEmailComposition(makeInput());
    expect(result.subject).toBe("Boleta de Honorarios - Mayo 2026 - María José");
  });

  it("includes the employee name and month in the plain-text body", () => {
    const result = buildTimesheetEmailComposition(makeInput());
    expect(result.text).toContain("Estimado/a María José,");
    expect(result.text).toContain("periodo Mayo 2026");
  });

  it("sums worked + overtime minutes into total billable time", () => {
    // 9000 + 600 = 9600 min -> 160:00
    const result = buildTimesheetEmailComposition(makeInput());
    expect(result.text).toContain("Tiempo total facturable: 160:00");
  });

  it("formats the monetary totals in the text body", () => {
    const result = buildTimesheetEmailComposition(makeInput());
    expect(result.text).toContain("Monto bruto honorarios: $1.000.000");
    expect(result.text).toContain("Retención (12,7%): $127.000");
    expect(result.text).toContain("Líquido estimado: $873.000");
  });

  it("renders the pay date as day-month-year", () => {
    const result = buildTimesheetEmailComposition(makeInput());
    expect(result.text).toContain("Fecha estimada de pago: 05-06-2026");
  });

  it("uppercases role and month in the boleta description", () => {
    const result = buildTimesheetEmailComposition(makeInput());
    expect(result.text).toContain(
      "SERVICIOS PROFESIONALES DE ENFERMERA - PERIODO MAYO 2026 - TIEMPO FACTURABLE 160:00"
    );
  });

  it("escapes HTML-special characters in the html body but not the text body", () => {
    const input = makeInput({ employeeName: "María <José> & Co" });
    const result = buildTimesheetEmailComposition(input);
    expect(result.html).toContain("María &lt;José&gt; &amp; Co");
    expect(result.html).not.toContain("María <José> & Co");
    // Plain text is not escaped.
    expect(result.text).toContain("María <José> & Co");
  });

  it("falls back to retention_rate when retentionRate is absent", () => {
    const input = makeInput();
    input.summary.retentionRate = null;
    input.summary.retention_rate = 0.2;
    const result = buildTimesheetEmailComposition(input);
    expect(result.text).toContain("Retención (20%):");
  });

  it("falls back to the default 12.75% retention when both rates are absent", () => {
    const input = makeInput();
    input.summary.retentionRate = null;
    input.summary.retention_rate = null;
    const result = buildTimesheetEmailComposition(input);
    expect(result.text).toContain("Retención (12,75%):");
  });

  it("treats null worked/overtime minutes as zero", () => {
    const input = makeInput();
    input.summary.workedMinutes = null;
    input.summary.overtimeMinutes = null;
    const result = buildTimesheetEmailComposition(input);
    expect(result.text).toContain("Tiempo total facturable: 00:00");
  });
});
