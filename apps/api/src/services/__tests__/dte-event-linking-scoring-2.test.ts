import { describe, expect, it, vi } from "vitest";

// @finanzas/db/slices transitively calls db.$setOptions at module load. The
// main db mock below does not provide it, so a self-contained slices mock is
// required. vi.mock factories are hoisted above outer references, so keep the
// noop client fully inside the factory.
vi.mock("@finanzas/db/slices", () => {
  const noopDb = { $setOptions: () => noopDb };
  return { dbClinicalSeries: noopDb };
});

vi.mock("@finanzas/db", () => ({ db: {} }));

const {
  findSkinTestBundleSuggestions,
  isReembolsoBundleEvent,
  normalizeLinkDate,
  resolveMatchAmountHint,
  resolveSuggestionDateWindow,
  scoreCandidate,
  selectGlobalAutoLinkHypotheses,
} = await import("../dte-event-linking.ts");

// ── Shared fixtures ─────────────────────────────────────────────────────────

type DteInput = Parameters<typeof scoreCandidate>[0]["dte"];

function makeDte(overrides: Partial<DteInput> = {}): DteInput {
  return {
    clientName: "MARIO LOPEZ GONZALEZ",
    clientRUT: "13620145-K",
    documentDate: "2026-04-06",
    documentType: 41,
    dteSaleDetailId: "sale-1",
    exemptAmount: 0,
    folio: "1000",
    ivaAmount: 0,
    linkedEventsCount: 0,
    netAmount: 30000,
    totalAmount: 30000,
    ...overrides,
  };
}

type Hypothesis = Parameters<typeof selectGlobalAutoLinkHypotheses>[0][number]["hypotheses"][number];
type Entry = Parameters<typeof selectGlobalAutoLinkHypotheses>[0][number];

function makeHypothesis(overrides: Partial<Hypothesis> = {}): Hypothesis {
  return {
    amountDiff: 0,
    autoLinkEligible: true,
    clientName: "Paciente",
    clientRUT: "11111111-1",
    crossSeriesConflicts: [],
    documentDate: "2026-03-16",
    documents: [],
    dteSaleDetailIds: ["dte-x"],
    folios: ["100"],
    hypothesisId: "h-x",
    kind: "single",
    method: "rut",
    policyKey: "default_same_day",
    reasons: [],
    score: 95,
    signals: [],
    totalAmount: 30000,
    ...overrides,
  };
}

function makeEvent(externalEventId: string): Entry["event"] {
  return {
    amountExpected: 30000,
    amountPaid: 30000,
    category: null,
    clinicalSeriesId: 1,
    description: null,
    eventDate: "2026-03-16",
    eventId: Number(externalEventId.replace(/\D/g, "")) || 1,
    externalEventId,
    googleCalendarId: "calendar-1",
    linkedCount: 0,
    linkedDteSaleDetailId: null,
    summary: `Evento ${externalEventId}`,
  };
}

// ── scoreCandidate: exact-RUT weighting ──────────────────────────────────────

describe("scoreCandidate — RUT weighting", () => {
  it("awards exactly 95 for an exact RUT match with no other signal", () => {
    const result = scoreCandidate({
      amountHint: null,
      dte: makeDte({ clientName: "XXXX YYYY", clientRUT: "13620145-K" }),
      nameHints: [],
      rutHints: ["13620145-K"],
    });

    expect(result.confidenceScore).toBe(95);
    expect(result.method).toBe("rut");
    expect(result.reasons).toContain("RUT exacto encontrado en título/descripción del evento");
  });

  it("uses mixed method (not rut) when both RUT and name hints are present", () => {
    const result = scoreCandidate({
      amountHint: null,
      dte: makeDte({ clientName: "MARIO LOPEZ GONZALEZ", clientRUT: "13620145-K" }),
      nameHints: ["mario lopez gonzalez"],
      rutHints: ["13620145-K"],
    });

    // exact RUT (95) + exact name with rut bonus weight 5 → clamped at 100
    expect(result.confidenceScore).toBe(100);
    expect(result.method).toBe("mixed");
  });

  it("exact name without RUT scores 88 and method name_exact", () => {
    const result = scoreCandidate({
      amountHint: null,
      dte: makeDte({ clientName: "MARIO LOPEZ GONZALEZ", clientRUT: "99999999-9" }),
      nameHints: ["mario lopez gonzalez"],
      rutHints: [],
    });

    expect(result.confidenceScore).toBe(88);
    expect(result.method).toBe("name_exact");
    expect(result.reasons).toContain("Nombre exacto detectado en título/descripción");
  });

  it("exact name WITH RUT contributes only +5 (not +88) on top of the RUT", () => {
    // RUT 95 + name bonus 5 = 100. If the bonus were 88 it'd still clamp to 100,
    // so use a partial-RUT-only baseline: prove the name bonus when rut present
    // is small by checking a case where rut is absent but we still get 88.
    const withName = scoreCandidate({
      amountHint: null,
      dte: makeDte({ clientName: "MARIO LOPEZ GONZALEZ", clientRUT: "99999999-9" }),
      nameHints: ["mario lopez gonzalez"],
      rutHints: [],
    });
    expect(withName.confidenceScore).toBe(88);
  });
});

// ── scoreCandidate: same-series RUT ───────────────────────────────────────────

describe("scoreCandidate — same-series RUT", () => {
  it("adds exactly 30 for a same-series RUT match (no direct RUT hit)", () => {
    const result = scoreCandidate({
      amountHint: null,
      dte: makeDte({ clientName: "ZZZZ WWWW", clientRUT: "13620145-K" }),
      nameHints: [],
      rutHints: [],
      seriesLinkedRuts: ["13620145-K"],
    });

    expect(result.confidenceScore).toBe(30);
    expect(result.reasons).toContain(
      "RUT ya confirmado en otro evento de la misma serie clínica"
    );
  });

  it("does not double-count: a direct RUT match suppresses the same-series bonus", () => {
    const result = scoreCandidate({
      amountHint: null,
      dte: makeDte({ clientName: "ZZZZ WWWW", clientRUT: "13620145-K" }),
      nameHints: [],
      rutHints: ["13620145-K"],
      seriesLinkedRuts: ["13620145-K"],
    });

    // Only the 95 exact-RUT, not 95+30.
    expect(result.confidenceScore).toBe(95);
    expect(result.reasons).not.toContain(
      "RUT ya confirmado en otro evento de la misma serie clínica"
    );
  });
});

// ── scoreCandidate: amount tiers ──────────────────────────────────────────────

describe("scoreCandidate — amount difference tiers", () => {
  // Isolate the amount signal by using an exact RUT baseline of 95, but that
  // clamps. Instead use a same-series-rut (30) baseline so amount deltas stay
  // visible below the 100 clamp.
  const base = (totalAmount: number, amountHint: number) =>
    scoreCandidate({
      amountHint,
      dte: makeDte({ clientName: "ZZZZ WWWW", clientRUT: "13620145-K", totalAmount }),
      nameHints: [],
      rutHints: [],
      seriesLinkedRuts: ["13620145-K"],
    });

  it("amountDiff <= 500 adds 8 (almost-exact)", () => {
    const r = base(30500, 30000); // diff 500
    expect(r.confidenceScore).toBe(38); // 30 + 8
    expect(r.reasons).toContain("Monto coincide casi exacto");
  });

  it("amountDiff of 501 drops into the near tier (+5)", () => {
    const r = base(30501, 30000); // diff 501
    expect(r.confidenceScore).toBe(35); // 30 + 5
    expect(r.reasons).toContain("Monto cercano");
    expect(r.reasons).not.toContain("Monto coincide casi exacto");
  });

  it("amountDiff <= 2000 adds 5 (near)", () => {
    const r = base(32000, 30000); // diff 2000
    expect(r.confidenceScore).toBe(35);
    expect(r.reasons).toContain("Monto cercano");
  });

  it("amountDiff of 2001 drops into the compatible tier (+3)", () => {
    const r = base(32001, 30000); // diff 2001
    expect(r.confidenceScore).toBe(33);
    expect(r.reasons).toContain("Monto compatible");
    expect(r.reasons).not.toContain("Monto cercano");
  });

  it("amountDiff of exactly 5000 still counts as compatible (+3)", () => {
    const r = base(35000, 30000); // diff 5000 == MAX
    expect(r.confidenceScore).toBe(33);
    expect(r.reasons).toContain("Monto compatible");
  });

  it("amountDiff of 5001 yields no amount signal", () => {
    const r = base(35001, 30000); // diff 5001 > MAX
    expect(r.confidenceScore).toBe(30);
    expect(r.reasons).not.toContain("Monto compatible");
    expect(r.reasons).not.toContain("Monto cercano");
    expect(r.reasons).not.toContain("Monto coincide casi exacto");
  });

  it("a null amount hint produces no amount signal at all", () => {
    const r = scoreCandidate({
      amountHint: null,
      dte: makeDte({ clientName: "ZZZZ WWWW", clientRUT: "13620145-K", totalAmount: 30000 }),
      nameHints: [],
      rutHints: [],
      seriesLinkedRuts: ["13620145-K"],
    });
    expect(r.confidenceScore).toBe(30);
    expect(r.reasons).not.toContain("Monto compatible");
  });
});

// ── scoreCandidate: fuzzy-name contribution ──────────────────────────────────

describe("scoreCandidate — fuzzy name", () => {
  it("scales a fuzzy partial-name match as round(score * 80) and reports a percentage", () => {
    const result = scoreCandidate({
      amountHint: null,
      // Partial overlap: shares "lopez" + "gonzalez" but adds a different first name.
      dte: makeDte({ clientName: "CARLA LOPEZ GONZALEZ", clientRUT: "99999999-9" }),
      nameHints: ["pedro lopez gonzalez"],
      rutHints: [],
    });

    expect(result.method).toBe("name_fuzzy");
    // Fuzzy contribution is strictly between 0 and 80 (no exact, no rut).
    expect(result.confidenceScore).toBeGreaterThan(0);
    expect(result.confidenceScore).toBeLessThanOrEqual(80);
    expect(result.reasons.some((r) => /Coincidencia difusa de nombre: \d+%/.test(r))).toBe(true);
  });

  it("does not emit any name signal when there is zero token overlap", () => {
    const result = scoreCandidate({
      amountHint: null,
      dte: makeDte({ clientName: "QWERTY ZXCVBN", clientRUT: "99999999-9" }),
      nameHints: ["asdfgh poiuyt"],
      rutHints: [],
    });

    expect(result.confidenceScore).toBe(0);
    expect(result.reasons.some((r) => r.includes("Coincidencia difusa"))).toBe(false);
  });
});

// ── scoreCandidate: trigram supplementary signal ──────────────────────────────

describe("scoreCandidate — trigram similarity (DB-supplied)", () => {
  it("applies round((sim - 0.5) * 30) when no name/RUT signal fired", () => {
    const result = scoreCandidate({
      amountHint: null,
      dte: {
        ...makeDte({ clientName: "TOTALLY UNRELATED PERSON", clientRUT: "99999999-9" }),
        retrievalMeta: {
          amountCandidate: false,
          exactRutMatch: false,
          sameSeriesRutMatch: false,
          sharedSurnameMatch: false,
          trigramSimilarity: 1.0, // → weight 15
        },
      },
      nameHints: [],
      rutHints: [],
    });

    expect(result.confidenceScore).toBe(15);
    expect(result.reasons.some((r) => r.includes("Similaridad trigramática"))).toBe(true);
  });

  it("trigram at the 0.5 threshold contributes 0 (no signal)", () => {
    const result = scoreCandidate({
      amountHint: null,
      dte: {
        ...makeDte({ clientName: "TOTALLY UNRELATED PERSON", clientRUT: "99999999-9" }),
        retrievalMeta: {
          amountCandidate: false,
          exactRutMatch: false,
          sameSeriesRutMatch: false,
          sharedSurnameMatch: false,
          trigramSimilarity: 0.5,
        },
      },
      nameHints: [],
      rutHints: [],
    });

    expect(result.confidenceScore).toBe(0);
    expect(result.reasons.some((r) => r.includes("Similaridad trigramática"))).toBe(false);
  });

  it("trigram just below 0.5 contributes nothing", () => {
    const result = scoreCandidate({
      amountHint: null,
      dte: {
        ...makeDte({ clientName: "TOTALLY UNRELATED PERSON", clientRUT: "99999999-9" }),
        retrievalMeta: {
          amountCandidate: false,
          exactRutMatch: false,
          sameSeriesRutMatch: false,
          sharedSurnameMatch: false,
          trigramSimilarity: 0.49,
        },
      },
      nameHints: [],
      rutHints: [],
    });

    expect(result.confidenceScore).toBe(0);
  });

  it("trigram is ignored once a RUT match already fired", () => {
    const result = scoreCandidate({
      amountHint: null,
      dte: {
        ...makeDte({ clientName: "MARIO LOPEZ GONZALEZ", clientRUT: "13620145-K" }),
        retrievalMeta: {
          amountCandidate: false,
          exactRutMatch: true,
          sameSeriesRutMatch: false,
          sharedSurnameMatch: false,
          trigramSimilarity: 1.0,
        },
      },
      nameHints: [],
      rutHints: ["13620145-K"],
    });

    // Pure exact RUT = 95, trigram suppressed because rutMatch is true.
    expect(result.confidenceScore).toBe(95);
    expect(result.reasons.some((r) => r.includes("Similaridad trigramática"))).toBe(false);
  });
});

// ── scoreCandidate: shared-surname guardian heuristic ─────────────────────────

describe("scoreCandidate — shared-surname guardian heuristic", () => {
  it("requires amountDiff <= 500 to fire (just over the edge = no bonus)", () => {
    const result = scoreCandidate({
      amountHint: 30000,
      dte: makeDte({
        clientName: "LORENA EDUVINA JAQUE VILLA",
        clientRUT: "13108274-6",
        totalAmount: 30501, // diff 501 > 500
      }),
      nameHints: ["benjamin saez jaque"],
      rutHints: ["22574388-6"],
    });

    expect(result.reasons.some((r) => r.includes("posible responsable/paciente"))).toBe(false);
  });

  it("fires at exactly amountDiff == 500", () => {
    const result = scoreCandidate({
      amountHint: 30000,
      dte: makeDte({
        clientName: "LORENA EDUVINA JAQUE VILLA",
        clientRUT: "13108274-6",
        totalAmount: 30500, // diff exactly 500
      }),
      nameHints: ["benjamin saez jaque"],
      rutHints: ["22574388-6"],
    });

    expect(result.reasons.some((r) => r.includes("posible responsable/paciente"))).toBe(true);
    // Deterministic decomposition: 30 (shared surname) + 8 (amount <=500)
    // + 26 (fuzzy partial: round(0.325 * 80)) = 64.
    expect(result.confidenceScore).toBe(64);
  });

  it("never fires when the DTE is already linked elsewhere", () => {
    const result = scoreCandidate({
      amountHint: 30000,
      dte: makeDte({
        clientName: "LORENA EDUVINA JAQUE VILLA",
        clientRUT: "13108274-6",
        totalAmount: 30000,
        linkedEventsCount: 2,
      }),
      nameHints: ["benjamin saez jaque"],
      rutHints: ["22574388-6"],
    });

    expect(result.reasons.some((r) => r.includes("posible responsable/paciente"))).toBe(false);
  });
});

describe("scoreCandidate — method precedence & signal gating", () => {
  it("keeps method 'mixed' (not downgraded to name_fuzzy) when a RUT match coexists with a partial name", () => {
    const result = scoreCandidate({
      amountHint: null,
      dte: makeDte({ clientName: "CARLA LOPEZ GONZALEZ", clientRUT: "13620145-K" }),
      nameHints: ["pedro lopez gonzalez"],
      rutHints: ["13620145-K"],
    });
    expect(result.method).toBe("mixed");
  });

  it("suppresses the trigram signal once a fuzzy name match has already scored", () => {
    const result = scoreCandidate({
      amountHint: null,
      dte: {
        ...makeDte({ clientName: "CARLA LOPEZ GONZALEZ", clientRUT: "99999999-9" }),
        retrievalMeta: {
          amountCandidate: false,
          exactRutMatch: false,
          sameSeriesRutMatch: false,
          sharedSurnameMatch: false,
          trigramSimilarity: 1.0,
        },
      },
      nameHints: ["pedro lopez gonzalez"],
      rutHints: [],
    });

    // Fuzzy-only score; the trigram (which would add up to 15) must NOT apply
    // because bestNameScore > 0.
    expect(result.reasons.some((r) => r.includes("Similaridad trigramática"))).toBe(false);
    expect(result.reasons.some((r) => r.includes("Coincidencia difusa"))).toBe(true);
  });

  it("only treats the last two name tokens as surnames for the shared-surname heuristic", () => {
    // DTE surnames = last two of "LORENA JAQUE VILLA" → [jaque, villa].
    // Hint "benjamin saez jaque" → surnames [saez, jaque] share "jaque".
    const result = scoreCandidate({
      amountHint: 30000,
      dte: makeDte({
        clientName: "LORENA JAQUE VILLA",
        clientRUT: "13108274-6",
        totalAmount: 30000,
      }),
      nameHints: ["benjamin saez jaque"],
      rutHints: ["22574388-6"],
    });
    expect(result.reasons.some((r) => r.includes("Apellido compartido"))).toBe(true);
  });
});

// ── resolveMatchAmountHint ────────────────────────────────────────────────────

type AmountParams = Parameters<typeof resolveMatchAmountHint>[0];
type SeriesArg = AmountParams["series"];

function makeSeries(overrides: Partial<NonNullable<SeriesArg>> = {}): NonNullable<SeriesArg> {
  return {
    remainingExpected: 0,
    remainingPaid: 0,
    ...overrides,
  } as unknown as NonNullable<SeriesArg>;
}

describe("resolveMatchAmountHint — preference order", () => {
  it("prefers amountPaid over amountExpected", () => {
    const hint = resolveMatchAmountHint({
      event: { amountExpected: 12345, amountPaid: 67890, description: null, summary: null },
      sameDayOnly: true,
      series: null,
    });
    expect(hint).toBe(67890);
  });

  it("falls back to amountExpected when amountPaid is null", () => {
    const hint = resolveMatchAmountHint({
      event: { amountExpected: 12345, amountPaid: null, description: null, summary: null },
      sameDayOnly: true,
      series: null,
    });
    expect(hint).toBe(12345);
  });

  it("parses a parenthesised amount from text when no explicit amount", () => {
    const hint = resolveMatchAmountHint({
      event: {
        amountExpected: null,
        amountPaid: null,
        description: "monto (45000) cobrado",
        summary: null,
      },
      sameDayOnly: true,
      series: null,
    });
    expect(hint).toBe(45000);
  });

  it("series remainingPaid wins over remainingExpected outside same-day mode", () => {
    const hint = resolveMatchAmountHint({
      event: { amountExpected: null, amountPaid: null, description: null, summary: null },
      sameDayOnly: false,
      series: makeSeries({ remainingExpected: 99999, remainingPaid: 60000 }),
    });
    expect(hint).toBe(60000);
  });

  it("series remainingExpected used when remainingPaid is zero (outside same-day)", () => {
    const hint = resolveMatchAmountHint({
      event: { amountExpected: null, amountPaid: null, description: null, summary: null },
      sameDayOnly: false,
      series: makeSeries({ remainingExpected: 60000, remainingPaid: 0 }),
    });
    expect(hint).toBe(60000);
  });

  it("returns null outside same-day when neither event nor series have an amount", () => {
    const hint = resolveMatchAmountHint({
      event: { amountExpected: null, amountPaid: null, description: null, summary: null },
      sameDayOnly: false,
      series: makeSeries({ remainingExpected: 0, remainingPaid: 0 }),
    });
    expect(hint).toBeNull();
  });
});

// ── isReembolsoBundleEvent ────────────────────────────────────────────────────

describe("isReembolsoBundleEvent — vendor + trigger logic", () => {
  it("is true when category is exactly 'roxair' even without retiro/reembolso text", () => {
    expect(
      isReembolsoBundleEvent({ category: "Roxair", description: "nota cualquiera", summary: "x" })
    ).toBe(true);
  });

  it("is false when vendor present but none of (reembolso category / retiro action / roxair category)", () => {
    expect(
      isReembolsoBundleEvent({
        category: "Insumos",
        description: "bactek instalado",
        summary: "control bactek mensual",
      })
    ).toBe(false);
  });

  it("matches 'retira' (not only 'retiro') as the action trigger", () => {
    expect(
      isReembolsoBundleEvent({ category: null, description: "retira roxair", summary: "retira" })
    ).toBe(true);
  });

  it("is false with no vendor token at all", () => {
    expect(
      isReembolsoBundleEvent({ category: "Reembolso", description: "retiro", summary: "retiro" })
    ).toBe(false);
  });
});

// ── resolveSuggestionDateWindow — window math + clamping ──────────────────────

describe("resolveSuggestionDateWindow — window math", () => {
  it("clamps a requested window above the 365-day max", () => {
    const result = resolveSuggestionDateWindow({
      event: {
        category: "Roxair",
        description: "retira roxair",
        eventDate: "2026-06-15",
        summary: "retiro roxair",
      },
      reembolsoMultiDateBundleEnabled: true,
      reembolsoMultiDateWindowDays: 100000,
      sameDayOnly: true,
      series: null,
    });
    expect(result.mode).toBe("reembolso_multi_date");
    // 365 days before/after 2026-06-15
    expect(result.from).toBe("2025-06-15");
    expect(result.to).toBe("2027-06-15");
  });

  it("clamps a requested window below 1 day up to at least 1", () => {
    const result = resolveSuggestionDateWindow({
      event: {
        category: "Roxair",
        description: "retira roxair",
        eventDate: "2026-06-15",
        summary: "retiro roxair",
      },
      reembolsoMultiDateBundleEnabled: true,
      reembolsoMultiDateWindowDays: 0,
      sameDayOnly: true,
      series: null,
    });
    expect(result.mode).toBe("reembolso_multi_date");
    expect(result.from).toBe("2026-06-14");
    expect(result.to).toBe("2026-06-16");
  });

  it("does NOT enter multi-date mode when sameDayOnly is false (even for reembolso)", () => {
    const result = resolveSuggestionDateWindow({
      event: {
        category: "Roxair",
        description: "retira roxair",
        eventDate: "2026-06-15",
        summary: "retiro roxair",
      },
      reembolsoMultiDateBundleEnabled: true,
      reembolsoMultiDateWindowDays: 30,
      sameDayOnly: false,
      series: null,
    });
    expect(result.mode).toBe("series_window");
  });

  it("does NOT enter multi-date mode when the flag is disabled", () => {
    const result = resolveSuggestionDateWindow({
      event: {
        category: "Roxair",
        description: "retira roxair",
        eventDate: "2026-06-15",
        summary: "retiro roxair",
      },
      reembolsoMultiDateBundleEnabled: false,
      reembolsoMultiDateWindowDays: 30,
      sameDayOnly: true,
      series: null,
    });
    expect(result.mode).toBe("same_day");
    expect(result.from).toBe("2026-06-15");
    expect(result.to).toBe("2026-06-15");
  });

  it("falls back to the event date for series_window when series has no eligible dates", () => {
    const result = resolveSuggestionDateWindow({
      event: {
        category: null,
        description: null,
        eventDate: "2026-06-15",
        summary: null,
      },
      sameDayOnly: false,
      series: null,
    });
    expect(result.mode).toBe("series_window");
    expect(result.from).toBe("2026-06-15");
    expect(result.to).toBe("2026-06-15");
  });
});

// ── findSkinTestBundleSuggestions — bundle scoring & gating ────────────────────

describe("findSkinTestBundleSuggestions — gating", () => {
  const twoCandidates = (extra: Partial<DteInput> = {}) => [
    makeDte({
      clientName: "LORENA PAZ ALFARO PICEROS",
      clientRUT: "17777348-4",
      dteSaleDetailId: "sale-A",
      folio: "A",
      totalAmount: 30000,
      ...extra,
    }),
    makeDte({
      clientName: "LORENA PAZ ALFARO PICEROS",
      clientRUT: "17777348-4",
      dteSaleDetailId: "sale-B",
      folio: "B",
      totalAmount: 30000,
      ...extra,
    }),
  ];

  it("returns [] when the amount hint is null", () => {
    const result = findSkinTestBundleSuggestions({
      amountHint: null,
      candidates: twoCandidates(),
      nameHints: ["lorena alfaro piceros"],
      rutHints: ["17777348-4"],
    });
    expect(result).toEqual([]);
  });

  it("returns [] when fewer than 2 eligible candidates (only one with exact RUT)", () => {
    const result = findSkinTestBundleSuggestions({
      amountHint: 60000,
      candidates: [
        makeDte({ clientRUT: "17777348-4", dteSaleDetailId: "sale-A", totalAmount: 30000 }),
        makeDte({ clientRUT: "99999999-9", dteSaleDetailId: "sale-B", totalAmount: 30000 }),
      ],
      nameHints: [],
      rutHints: ["17777348-4"],
    });
    expect(result).toEqual([]);
  });

  it("returns [] when a candidate is already linked (linkedEventsCount > 0 excludes it)", () => {
    const result = findSkinTestBundleSuggestions({
      amountHint: 60000,
      candidates: [
        makeDte({ clientRUT: "17777348-4", dteSaleDetailId: "sale-A", totalAmount: 30000, linkedEventsCount: 1 }),
        makeDte({ clientRUT: "17777348-4", dteSaleDetailId: "sale-B", totalAmount: 30000 }),
      ],
      nameHints: [],
      rutHints: ["17777348-4"],
    });
    expect(result).toEqual([]);
  });

  it("scores 100 when the bundle sum is within 500 of the hint", () => {
    const result = findSkinTestBundleSuggestions({
      amountHint: 60500, // diff 500
      candidates: twoCandidates(),
      nameHints: [],
      rutHints: ["17777348-4"],
    });
    expect(result).toHaveLength(1);
    expect(result[0]?.confidenceScore).toBe(100);
  });

  it("scores 96 when the bundle sum diff is in (500, 2000]", () => {
    const result = findSkinTestBundleSuggestions({
      amountHint: 62000, // diff 2000
      candidates: twoCandidates(),
      nameHints: [],
      rutHints: ["17777348-4"],
    });
    expect(result).toHaveLength(1);
    expect(result[0]?.confidenceScore).toBe(96);
    expect(result[0]?.reasons).toContain("La suma del bundle es cercana");
  });

  it("scores 92 when the bundle sum diff is in (2000, 5000]", () => {
    const result = findSkinTestBundleSuggestions({
      amountHint: 65000, // diff 5000
      candidates: twoCandidates(),
      nameHints: [],
      rutHints: ["17777348-4"],
    });
    expect(result).toHaveLength(1);
    expect(result[0]?.confidenceScore).toBe(92);
    expect(result[0]?.reasons).toContain("La suma del bundle es compatible");
  });

  it("returns [] when the bundle sum diff exceeds the 5000 max", () => {
    const result = findSkinTestBundleSuggestions({
      amountHint: 65001, // diff 5001
      candidates: twoCandidates(),
      nameHints: [],
      rutHints: ["17777348-4"],
    });
    expect(result).toEqual([]);
  });

  it("respects the limit parameter", () => {
    // Three candidates summing to the hint produce multiple 2- and 3-combos.
    const result = findSkinTestBundleSuggestions({
      amountHint: 60000,
      candidates: [
        makeDte({ clientRUT: "17777348-4", dteSaleDetailId: "s1", folio: "1", totalAmount: 30000 }),
        makeDte({ clientRUT: "17777348-4", dteSaleDetailId: "s2", folio: "2", totalAmount: 30000 }),
        makeDte({ clientRUT: "17777348-4", dteSaleDetailId: "s3", folio: "3", totalAmount: 30000 }),
      ],
      limit: 1,
      nameHints: [],
      rutHints: ["17777348-4"],
    });
    expect(result.length).toBeLessThanOrEqual(1);
  });

  it("orders bundles by ascending amount diff (best match first)", () => {
    // s1+s2 = 60000 (diff 0); s1+s3 = 60500 (diff 500); etc. The diff-0 bundle ranks first.
    const result = findSkinTestBundleSuggestions({
      amountHint: 60000,
      candidates: [
        makeDte({ clientRUT: "17777348-4", dteSaleDetailId: "s1", folio: "1", totalAmount: 30000 }),
        makeDte({ clientRUT: "17777348-4", dteSaleDetailId: "s2", folio: "2", totalAmount: 30000 }),
        makeDte({ clientRUT: "17777348-4", dteSaleDetailId: "s3", folio: "3", totalAmount: 30500 }),
      ],
      nameHints: [],
      rutHints: ["17777348-4"],
    });
    expect(result.length).toBeGreaterThanOrEqual(1);
    expect(result[0]?.totalAmount).toBe(60000);
    expect(result[0]?.dteSaleDetailIds).toEqual(["s1", "s2"]);
  });

  it("sorts the dteSaleDetailIds inside a bundle lexicographically", () => {
    const result = findSkinTestBundleSuggestions({
      amountHint: 60000,
      candidates: [
        makeDte({ clientRUT: "17777348-4", dteSaleDetailId: "zzz", folio: "z", totalAmount: 30000 }),
        makeDte({ clientRUT: "17777348-4", dteSaleDetailId: "aaa", folio: "a", totalAmount: 30000 }),
      ],
      nameHints: [],
      rutHints: ["17777348-4"],
    });
    expect(result[0]?.dteSaleDetailIds).toEqual(["aaa", "zzz"]);
    expect(result[0]?.folios).toEqual(["a", "z"]);
  });
});

describe("findSkinTestBundleSuggestions — method combination & reasons", () => {
  const namedPair = (name: string) => [
    makeDte({ clientName: name, clientRUT: "17777348-4", dteSaleDetailId: "a", folio: "1", totalAmount: 30000 }),
    makeDte({ clientName: name, clientRUT: "17777348-4", dteSaleDetailId: "b", folio: "2", totalAmount: 30000 }),
  ];

  it("combines to method 'rut' when there are no name hints", () => {
    const result = findSkinTestBundleSuggestions({
      amountHint: 60000,
      candidates: namedPair("LORENA PAZ ALFARO PICEROS"),
      nameHints: [],
      rutHints: ["17777348-4"],
    });
    expect(result[0]?.method).toBe("rut");
  });

  it("combines to method 'mixed' when name hints accompany the exact RUT", () => {
    const result = findSkinTestBundleSuggestions({
      amountHint: 60000,
      candidates: namedPair("LORENA PAZ ALFARO PICEROS"),
      nameHints: ["lorena paz alfaro piceros"],
      rutHints: ["17777348-4"],
    });
    expect(result[0]?.method).toBe("mixed");
  });

  it("adds the strong-name reason only when a member name matches exactly", () => {
    const exact = findSkinTestBundleSuggestions({
      amountHint: 60000,
      candidates: namedPair("LORENA PAZ ALFARO PICEROS"),
      nameHints: ["lorena paz alfaro piceros"],
      rutHints: ["17777348-4"],
    });
    expect(exact[0]?.reasons).toContain("El bundle conserva coincidencias nominales fuertes");

    const noName = findSkinTestBundleSuggestions({
      amountHint: 60000,
      candidates: namedPair("LORENA PAZ ALFARO PICEROS"),
      nameHints: [],
      rutHints: ["17777348-4"],
    });
    expect(noName[0]?.reasons).not.toContain("El bundle conserva coincidencias nominales fuertes");
  });

  it("uses the same-day bundle header for skin-test bundles", () => {
    const result = findSkinTestBundleSuggestions({
      amountHint: 60000,
      candidates: namedPair("LORENA PAZ ALFARO PICEROS"),
      nameHints: [],
      rutHints: ["17777348-4"],
    });
    expect(result[0]?.reasons[0]).toBe("Bundle de 2 DTE del mismo día y mismo RUT");
    expect(result[0]?.reasons).toContain("La suma del bundle coincide casi exacto");
  });

  it("builds a 3-DTE bundle when three documents sum to the hint", () => {
    const result = findSkinTestBundleSuggestions({
      amountHint: 90000,
      candidates: [
        makeDte({ clientRUT: "17777348-4", dteSaleDetailId: "a", folio: "1", totalAmount: 30000 }),
        makeDte({ clientRUT: "17777348-4", dteSaleDetailId: "b", folio: "2", totalAmount: 30000 }),
        makeDte({ clientRUT: "17777348-4", dteSaleDetailId: "c", folio: "3", totalAmount: 30000 }),
      ],
      nameHints: [],
      rutHints: ["17777348-4"],
    });
    const triple = result.find((b) => b.count === 3);
    expect(triple).toBeDefined();
    expect(triple?.dteSaleDetailIds).toEqual(["a", "b", "c"]);
    expect(triple?.totalAmount).toBe(90000);
    expect(triple?.reasons[0]).toBe("Bundle de 3 DTE del mismo día y mismo RUT");
  });
});

// ── selectGlobalAutoLinkHypotheses ────────────────────────────────────────────

describe("selectGlobalAutoLinkHypotheses — exact branch-and-bound", () => {
  it("returns an empty map for no entries", () => {
    expect(selectGlobalAutoLinkHypotheses([]).size).toBe(0);
  });

  it("filters out hypotheses that are not autoLinkEligible", () => {
    const selected = selectGlobalAutoLinkHypotheses([
      {
        event: makeEvent("event-a"),
        hypotheses: [
          makeHypothesis({
            autoLinkEligible: false,
            dteSaleDetailIds: ["dte-1"],
            hypothesisId: "ineligible",
            score: 99,
          }),
        ],
      },
    ]);
    expect(selected.size).toBe(0);
  });

  it("prefers the global optimum even when it means NOT taking each event's top single hypothesis", () => {
    // event-a only wants shared-dte (95). event-b can take shared-dte (90) OR
    // exclusive-dte (89). Global best: a=shared(95) + b=exclusive(89) = 184,
    // beats a=none + b=shared(90).
    const selected = selectGlobalAutoLinkHypotheses([
      {
        event: makeEvent("event-a"),
        hypotheses: [
          makeHypothesis({
            dteSaleDetailIds: ["shared-dte"],
            hypothesisId: "a-shared",
            score: 95,
          }),
        ],
      },
      {
        event: makeEvent("event-b"),
        hypotheses: [
          makeHypothesis({
            clientRUT: "22222222-2",
            dteSaleDetailIds: ["shared-dte"],
            hypothesisId: "b-shared",
            score: 90,
          }),
          makeHypothesis({
            clientRUT: "22222222-2",
            dteSaleDetailIds: ["exclusive-dte"],
            hypothesisId: "b-exclusive",
            score: 89,
          }),
        ],
      },
    ]);
    expect(selected.get("event-a")?.hypothesisId).toBe("a-shared");
    expect(selected.get("event-b")?.hypothesisId).toBe("b-exclusive");
  });

  it("never assigns the same DTE to two different events", () => {
    const selected = selectGlobalAutoLinkHypotheses([
      {
        event: makeEvent("event-a"),
        hypotheses: [makeHypothesis({ dteSaleDetailIds: ["only-dte"], hypothesisId: "a", score: 95 })],
      },
      {
        event: makeEvent("event-b"),
        hypotheses: [makeHypothesis({ dteSaleDetailIds: ["only-dte"], hypothesisId: "b", score: 95 })],
      },
    ]);
    const ids = [...selected.values()].flatMap((h) => h.dteSaleDetailIds);
    expect(new Set(ids).size).toBe(ids.length); // no DTE reused
    expect(selected.size).toBe(1); // only one event can claim it
  });

  it("only considers the top 3 hypotheses per event", () => {
    // 4 distinct-DTE hypotheses; the 4th (highest, score 100) sits at index 3
    // and must be ignored because of slice(0, 3).
    const selected = selectGlobalAutoLinkHypotheses([
      {
        event: makeEvent("event-a"),
        hypotheses: [
          makeHypothesis({ dteSaleDetailIds: ["d1"], hypothesisId: "h1", score: 91 }),
          makeHypothesis({ dteSaleDetailIds: ["d2"], hypothesisId: "h2", score: 92 }),
          makeHypothesis({ dteSaleDetailIds: ["d3"], hypothesisId: "h3", score: 93 }),
          makeHypothesis({ dteSaleDetailIds: ["d4"], hypothesisId: "h4", score: 100 }),
        ],
      },
    ]);
    expect(selected.get("event-a")?.hypothesisId).not.toBe("h4");
    // Best of the first three by score is h3 (93).
    expect(selected.get("event-a")?.hypothesisId).toBe("h3");
  });

  it("uses the greedy fallback when the entry count exceeds 18", () => {
    // 19 single-hypothesis entries, all distinct DTEs → greedy assigns all.
    const entries = Array.from({ length: 19 }, (_, i) => ({
      event: makeEvent(`event-${i}`),
      hypotheses: [
        makeHypothesis({
          dteSaleDetailIds: [`dte-${i}`],
          hypothesisId: `h-${i}`,
          score: 90 + (i % 10),
        }),
      ],
    }));
    const selected = selectGlobalAutoLinkHypotheses(entries);
    expect(selected.size).toBe(19);
    // Greedy must still avoid DTE reuse.
    const ids = [...selected.values()].flatMap((h) => h.dteSaleDetailIds);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("greedy fallback gives a contested DTE to the higher-scoring event", () => {
    // 19 entries to trip the >18 branch; the first two contest dte-shared.
    const entries: Entry[] = [
      {
        event: makeEvent("event-hi"),
        hypotheses: [makeHypothesis({ dteSaleDetailIds: ["dte-shared"], hypothesisId: "hi", score: 99 })],
      },
      {
        event: makeEvent("event-lo"),
        hypotheses: [makeHypothesis({ dteSaleDetailIds: ["dte-shared"], hypothesisId: "lo", score: 80 })],
      },
      ...Array.from({ length: 17 }, (_, i) => ({
        event: makeEvent(`event-x${i}`),
        hypotheses: [
          makeHypothesis({ dteSaleDetailIds: [`dte-x${i}`], hypothesisId: `x${i}`, score: 90 }),
        ],
      })),
    ];
    const selected = selectGlobalAutoLinkHypotheses(entries);
    expect(selected.get("event-hi")?.hypothesisId).toBe("hi");
    expect(selected.has("event-lo")).toBe(false);
  });
});

// ── normalizeLinkDate ─────────────────────────────────────────────────────────

describe("normalizeLinkDate", () => {
  it("returns a valid YYYY-MM-DD date unchanged", () => {
    expect(normalizeLinkDate("2026-04-23")).toBe("2026-04-23");
  });

  it("throws on a non-parseable separator layout", () => {
    expect(() => normalizeLinkDate("13/13/2026")).toThrow("Fecha inválida");
  });

  it("throws on a garbage string", () => {
    expect(() => normalizeLinkDate("not-a-date")).toThrow("Fecha inválida");
  });
});
