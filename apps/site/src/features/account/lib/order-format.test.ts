import { describe, expect, it } from "vitest";

import { formatItemCount, formatOrderDateShort, formatOrderDateTime } from "./order-format";

// Anchor the locale formatters to a fixed UTC instant. We don't assert the
// exact locale string (it varies by ICU / runtime); we assert the function is
// a thin, deterministic wrapper over `Date#toLocale*` so coverage exercises
// every line. Equivalence to the native call is what we pin.
const CREATED_AT = "2026-06-10T15:00:00Z";

describe("formatOrderDateShort", () => {
  it("matches Date#toLocaleDateString('es-CL')", () => {
    expect(formatOrderDateShort(CREATED_AT)).toBe(new Date(CREATED_AT).toLocaleDateString("es-CL"));
  });
});

describe("formatOrderDateTime", () => {
  it("matches Date#toLocaleString('es-CL')", () => {
    expect(formatOrderDateTime(CREATED_AT)).toBe(new Date(CREATED_AT).toLocaleString("es-CL"));
  });

  it("includes more characters than the date-only variant (carries the time)", () => {
    expect(formatOrderDateTime(CREATED_AT).length).toBeGreaterThan(
      formatOrderDateShort(CREATED_AT).length
    );
  });
});

describe("formatItemCount", () => {
  it("renders the pluralized item label", () => {
    expect(formatItemCount(3)).toBe("3 ítem(s)");
    expect(formatItemCount(0)).toBe("0 ítem(s)");
    expect(formatItemCount(1)).toBe("1 ítem(s)");
  });
});
