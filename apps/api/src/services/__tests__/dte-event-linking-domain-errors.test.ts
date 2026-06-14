import { describe, expect, it, vi } from "vitest";

// Mutation-killing tests for the DomainError branches of dte-event-linking.ts.
// A recent commit converted `throw new Error` → `throw new DomainError(kind, msg)`;
// Stryker mutates both the kind and the message, so every assertion below pins
// the EXACT `.kind` AND `.message` to make those mutants die.
//
// @finanzas/db/slices runs db.$setOptions(...) at module load (via the
// transitive clinical-series import), so it MUST expose $setOptions or the
// import throws. The main @finanzas/db mock exposes a queue-driven $queryRaw so
// confirmEventDteLink's two sequential raw queries can be steered per-test.

vi.mock("@finanzas/db/slices", () => {
  const noopDb = { $setOptions: () => noopDb };
  return { dbClinicalSeries: noopDb };
});

const { queryRawQueue, mockQueryRaw } = vi.hoisted(() => {
  const queryRawQueue: unknown[] = [];
  const mockQueryRaw = vi.fn(() => {
    // db.$queryRaw is tagged-template; we ignore args and shift the queue.
    return Promise.resolve(queryRawQueue.length > 0 ? queryRawQueue.shift() : []);
  });
  return { queryRawQueue, mockQueryRaw };
});

vi.mock("@finanzas/db", () => ({
  db: {
    $queryRaw: (...a: unknown[]) => mockQueryRaw(...a),
    $executeRaw: () => Promise.resolve(undefined),
  },
}));

const { DomainError } = await import("../../lib/errors.ts");
const {
  autoLinkEventDate,
  autoLinkEventPeriod,
  confirmEventDteLink,
  listEventDteLinkOverview,
  normalizeLinkDate,
} = await import("../dte-event-linking.ts");

function resetQueue() {
  queryRawQueue.length = 0;
  mockQueryRaw.mockClear();
}

// ── normalizeLinkDate (pure validator) ───────────────────────────────────
describe("normalizeLinkDate", () => {
  it("acepta una fecha YYYY-MM-DD válida y la devuelve intacta", () => {
    expect(normalizeLinkDate("2026-02-28")).toBe("2026-02-28");
  });

  it("lanza BAD_REQUEST con mensaje exacto cuando el formato no es YYYY-MM-DD", () => {
    expect(() => normalizeLinkDate("28-02-2026")).toThrow(DomainError);
    try {
      normalizeLinkDate("28-02-2026");
      throw new Error("no lanzó");
    } catch (err) {
      expect(err).toBeInstanceOf(DomainError);
      expect((err as DomainError).kind).toBe("BAD_REQUEST");
      expect((err as DomainError).message).toBe("Fecha inválida. Usa formato YYYY-MM-DD");
    }
  });

  it("lanza BAD_REQUEST con mensaje exacto para una fecha imposible (Feb 30)", () => {
    // Bien formada pero inexistente: golpea la SEGUNDA rama (rollover guard).
    try {
      normalizeLinkDate("2026-02-30");
      throw new Error("no lanzó");
    } catch (err) {
      expect(err).toBeInstanceOf(DomainError);
      expect((err as DomainError).kind).toBe("BAD_REQUEST");
      expect((err as DomainError).message).toBe("Fecha inválida. Usa formato YYYY-MM-DD");
    }
  });
});

// ── autoLinkEventPeriod (period validator, throws before any DB) ──────────
describe("autoLinkEventPeriod", () => {
  it("lanza BAD_REQUEST con mensaje exacto cuando el periodo no es YYYY-MM", async () => {
    resetQueue();
    try {
      await autoLinkEventPeriod({ period: "2026/05", userId: 1 });
      throw new Error("no lanzó");
    } catch (err) {
      expect(err).toBeInstanceOf(DomainError);
      expect((err as DomainError).kind).toBe("BAD_REQUEST");
      expect((err as DomainError).message).toBe("Periodo inválido. Usa formato YYYY-MM");
    }
    // El throw ocurre antes de tocar la DB.
    expect(mockQueryRaw).not.toHaveBeenCalled();
  });

  it("rechaza un mes fuera de rango (13) con el mismo mensaje", async () => {
    resetQueue();
    await expect(autoLinkEventPeriod({ period: "2026-13", userId: 1 })).rejects.toMatchObject({
      kind: "BAD_REQUEST",
      message: "Periodo inválido. Usa formato YYYY-MM",
    });
  });
});

// ── listEventDteLinkOverview (period validator, distinct throw site) ──────
describe("listEventDteLinkOverview", () => {
  it("lanza BAD_REQUEST con mensaje exacto cuando el periodo no es YYYY-MM", async () => {
    resetQueue();
    try {
      await listEventDteLinkOverview({ period: "mayo-2026" });
      throw new Error("no lanzó");
    } catch (err) {
      expect(err).toBeInstanceOf(DomainError);
      expect((err as DomainError).kind).toBe("BAD_REQUEST");
      expect((err as DomainError).message).toBe("Periodo inválido. Usa formato YYYY-MM");
    }
    expect(mockQueryRaw).not.toHaveBeenCalled();
  });
});

// ── autoLinkEventDate (future-date guard, throws before any DB) ───────────
describe("autoLinkEventDate", () => {
  it("lanza BAD_REQUEST con mensaje interpolado para una fecha futura", async () => {
    resetQueue();
    const future = "2999-12-31";
    try {
      await autoLinkEventDate({ date: future, userId: 1 });
      throw new Error("no lanzó");
    } catch (err) {
      expect(err).toBeInstanceOf(DomainError);
      expect((err as DomainError).kind).toBe("BAD_REQUEST");
      // Mensaje plantilla: incluye la fecha pedida, "Hoy es" y la timezone.
      expect((err as DomainError).message).toMatch(
        /^No se puede auto-vincular una fecha futura \(2999-12-31\)\. Hoy es \d{4}-\d{2}-\d{2} en America\/Santiago\.$/
      );
    }
    expect(mockQueryRaw).not.toHaveBeenCalled();
  });
});

// ── confirmEventDteLink (DB-backed validators) ───────────────────────────
describe("confirmEventDteLink", () => {
  const baseParams = {
    calendarId: "cal-1",
    eventId: "evt-1",
    userId: 1,
  };

  it("lanza NOT_FOUND 'Evento no encontrado' cuando el evento no existe", async () => {
    resetQueue();
    // getEventByExternalIds → primera $queryRaw devuelve [] (sin evento).
    queryRawQueue.push([]);
    try {
      await confirmEventDteLink({ ...baseParams, dteSaleDetailIds: ["d1"] });
      throw new Error("no lanzó");
    } catch (err) {
      expect(err).toBeInstanceOf(DomainError);
      expect((err as DomainError).kind).toBe("NOT_FOUND");
      expect((err as DomainError).message).toBe("Evento no encontrado");
    }
  });

  it("lanza BAD_REQUEST cuando no se indica ningún DTE", async () => {
    resetQueue();
    // Evento existe; dteSaleDetailIds vacío → rama "al menos un DTE".
    queryRawQueue.push([{ eventId: 42, externalEventId: "evt-1" }]);
    try {
      await confirmEventDteLink({ ...baseParams, dteSaleDetailIds: [] });
      throw new Error("no lanzó");
    } catch (err) {
      expect(err).toBeInstanceOf(DomainError);
      expect((err as DomainError).kind).toBe("BAD_REQUEST");
      expect((err as DomainError).message).toBe(
        "Debes indicar al menos un DTE para confirmar el vínculo"
      );
    }
  });

  it("lanza BAD_REQUEST cuando uno o más DTE no existen", async () => {
    resetQueue();
    // 1ª query: evento existe. 2ª query: piden 2 DTE pero la DB devuelve 1.
    queryRawQueue.push([{ eventId: 42, externalEventId: "evt-1" }]);
    queryRawQueue.push([{ id: "d1" }]);
    try {
      await confirmEventDteLink({ ...baseParams, dteSaleDetailIds: ["d1", "d2"] });
      throw new Error("no lanzó");
    } catch (err) {
      expect(err).toBeInstanceOf(DomainError);
      expect((err as DomainError).kind).toBe("BAD_REQUEST");
      expect((err as DomainError).message).toBe("Uno o más DTE de venta no existen");
    }
  });
});
