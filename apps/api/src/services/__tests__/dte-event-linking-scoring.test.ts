import { describe, expect, it, vi } from "vitest";

vi.mock("@finanzas/db", () => ({ db: {} }));

const { scoreCandidate } = await import("../dte-event-linking");

describe("scoreCandidate", () => {
  it("surfaces a same-day same-amount guardian/patient surname match as a review candidate", () => {
    const result = scoreCandidate({
      amountHint: 30000,
      dte: {
        clientName: "LORENA EDUVINA JAQUE VILLA",
        clientRUT: "13108274-6",
        documentDate: "2026-03-16",
        documentType: 41,
        dteSaleDetailId: "sale-1",
        exemptAmount: 0,
        folio: "20034",
        ivaAmount: 0,
        linkedEventsCount: 0,
        netAmount: 30000,
        totalAmount: 30000,
      },
      nameHints: ["benjamin saez jaque"],
      rutHints: ["22574388-6"],
    });

    expect(result.confidenceScore).toBeGreaterThanOrEqual(35);
    expect(result.reasons).toContain("Monto coincide casi exacto");
    expect(
      result.reasons.some((reason) =>
        reason.includes("posible responsable/paciente") && reason.includes("jaque"),
      ),
    ).toBe(true);
  });

  it("does not apply the guardian heuristic when the DTE is already linked elsewhere", () => {
    const result = scoreCandidate({
      amountHint: 30000,
      dte: {
        clientName: "LORENA EDUVINA JAQUE VILLA",
        clientRUT: "13108274-6",
        documentDate: "2026-03-16",
        documentType: 41,
        dteSaleDetailId: "sale-1",
        exemptAmount: 0,
        folio: "20034",
        ivaAmount: 0,
        linkedEventsCount: 1,
        netAmount: 30000,
        totalAmount: 30000,
      },
      nameHints: ["benjamin saez jaque"],
      rutHints: ["22574388-6"],
    });

    expect(result.confidenceScore).toBeLessThan(35);
    expect(
      result.reasons.some((reason) => reason.includes("posible responsable/paciente")),
    ).toBe(false);
  });
});
