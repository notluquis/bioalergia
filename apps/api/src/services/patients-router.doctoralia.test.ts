import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockDb } = vi.hoisted(() => ({
  mockDb: { doctoraliaCalendarAppointment: { findMany: vi.fn() } },
}));

// patients-router pulls in many deps; stub the heavy ones so importing the
// module for one function stays cheap and hermetic.
vi.mock("@finanzas/db", () => ({ db: mockDb, kysely: {} }));
vi.mock("@finanzas/db/slices", () => ({ dbClinicalSeries: mockDb }));

import { getPatientDoctoraliaAppointments } from "./patients-router.ts";

beforeEach(() => vi.clearAllMocks());

describe("getPatientDoctoraliaAppointments", () => {
  it("mapea a shape con fechas ISO, ordena por findMany(startAt desc)", async () => {
    mockDb.doctoraliaCalendarAppointment.findMany.mockResolvedValue([
      {
        id: 7,
        title: "Borja Contreras",
        startAt: new Date("2026-04-21T15:45:00.000Z"),
        endAt: new Date("2026-04-21T16:25:00.000Z"),
        serviceName: "Consulta",
        insuranceName: "Fonasa",
        comments: "abono listo",
        attendance: 1,
        status: 6,
      },
    ]);
    const r = await getPatientDoctoraliaAppointments(42);
    expect(mockDb.doctoraliaCalendarAppointment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { patientId: 42 }, orderBy: { startAt: "desc" } })
    );
    expect(r).toEqual([
      {
        id: 7,
        title: "Borja Contreras",
        startAt: "2026-04-21T15:45:00.000Z",
        endAt: "2026-04-21T16:25:00.000Z",
        serviceName: "Consulta",
        insuranceName: "Fonasa",
        comments: "abono listo",
        attendance: 1,
        status: 6,
      },
    ]);
  });

  it("lista vacía → []", async () => {
    mockDb.doctoraliaCalendarAppointment.findMany.mockResolvedValue([]);
    expect(await getPatientDoctoraliaAppointments(1)).toEqual([]);
  });
});
