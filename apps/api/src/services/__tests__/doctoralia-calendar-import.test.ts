import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DoctoraliaCalendarResponse } from "../../lib/doctoralia/doctoralia-calendar-types.ts";

const mockUpsertSchedules = vi.fn();
const mockUpsertAppointments = vi.fn();
const mockUpsertWorkPeriods = vi.fn();

vi.mock("../../lib/doctoralia/doctoralia-calendar-store", () => ({
  applyDoctoraliaAlertUpdates: vi.fn(),
  createDoctoraliaSyncLog: vi.fn(async () => ({ id: 1 })),
  updateDoctoraliaSyncLog: vi.fn(),
  upsertDoctoraliaAppointments: (...args: unknown[]) => mockUpsertAppointments(...args),
  upsertDoctoraliaSchedules: (...args: unknown[]) => mockUpsertSchedules(...args),
  upsertDoctoraliaWorkPeriods: (...args: unknown[]) => mockUpsertWorkPeriods(...args),
}));

vi.mock("../../lib/doctoralia/doctoralia-calendar-client", () => ({
  getCalendarAlerts: vi.fn(),
  getCalendarEvents: vi.fn(),
}));

vi.mock("../settings", () => ({
  getSetting: vi.fn(async () => null),
  updateSetting: vi.fn(async () => undefined),
}));

const { DoctoraliaCalendarSyncService } = await import("../doctoralia-calendar.ts");

function makeResponse(
  overrides: {
    scheduleId?: number;
    appointmentIds?: number[];
    workPeriodStarts?: string[];
  } = {}
): DoctoraliaCalendarResponse {
  const scheduleId = overrides.scheduleId ?? 1001;
  const appointmentIds = overrides.appointmentIds ?? [];
  const workPeriodStarts = overrides.workPeriodStarts ?? [];

  return {
    countryCode: "CL",
    schedules: {
      [String(scheduleId)]: {
        id: scheduleId,
        name: "Test",
        displayName: "Test Display",
        facilityId: 1,
        specialityId: 1,
        doctorId: 1,
        provinceId: null,
        cityId: null,
        hasWaitingRoom: null,
        scheduleType: 1,
        colorSchemaId: 1,
        isVirtual: false,
        patientsNotificationType: 0,
      },
    },
    colorSchemas: {},
    appointments: appointmentIds.map((id) => ({
      id,
      title: `Appt ${id}`,
      start: "2026-04-17T10:00:00",
      end: "2026-04-17T10:30:00",
      isBlock: false,
      eventType: 1,
      scheduledBy: 1,
      status: 4,
      hasPatient: true,
      hasWaitingRoom: null,
      insuranceId: null,
      insuranceName: null,
      comments: "",
      serviceId: 1,
      serviceName: "Consulta",
      eventServices: [],
      eventServicesIds: [],
      serviceColorSchemaId: 1,
      serviceIsDeleted: false,
      attendance: 0,
      patientId: id,
      patientReferenceId: "",
      patientPhone: "",
      patientEmail: "",
      patientBirthDate: null,
      patientArrivalTime: null,
      gruppoDefaultDoctor: null,
      scheduleId,
      colorSchemaId: null,
      recurrentSettingsId: null,
      roomName: null,
      roomId: null,
      roomColorSchemaId: null,
      isPatientFirstTime: false,
      isPatientFirstAdminBooking: false,
      isBookedViaSecretaryAi: false,
      followUpDateWithSameDoctor: null,
      onlinePaymentType: null,
      onlinePaymentStatus: null,
      isPaidOnline: false,
      communicationChannel: null,
      fake: false,
      isEventWithVoucher: false,
      duration: 30,
      canNotifyPatient: true,
      integrated: {
        hasError: false,
        errorMessage: null,
        isIntegrated: false,
        integrationSetup: 0,
      },
      noShowProtection: false,
      bnplStatus: null,
    })),
    blocks: [],
    holidays: [],
    workperiods: workPeriodStarts.map((start) => ({
      scheduleId,
      start,
      end: start,
      isPrivate: false,
    })),
    reminders: [],
    resources: [],
  };
}

describe("DoctoraliaCalendarSyncService.importFromJsonEntries", () => {
  beforeEach(() => {
    mockUpsertSchedules.mockReset();
    mockUpsertAppointments.mockReset();
    mockUpsertWorkPeriods.mockReset();
  });

  it("aggregates counts across multiple entries", async () => {
    mockUpsertSchedules.mockResolvedValue({ inserted: 1, updated: 0, skipped: 0 });
    mockUpsertAppointments.mockResolvedValue({ inserted: 2, updated: 1, skipped: 0 });
    mockUpsertWorkPeriods.mockResolvedValue({ inserted: 1, updated: 0, skipped: 0 });

    const service = new DoctoraliaCalendarSyncService();
    const entries = [
      { ts: "2026-04-17", data: makeResponse({ appointmentIds: [1, 2], workPeriodStarts: ["a"] }) },
      { ts: "2026-04-18", data: makeResponse({ appointmentIds: [3], workPeriodStarts: ["b"] }) },
    ];

    const result = await service.importFromJsonEntries(entries);

    expect(result.entriesProcessed).toBe(2);
    expect(result.summary.schedules.inserted).toBe(2);
    expect(result.summary.appointments.inserted).toBe(4);
    expect(result.summary.appointments.updated).toBe(2);
    expect(result.summary.workPeriods.inserted).toBe(2);
    expect(result.errors).toEqual([]);
  });

  it("continues on per-entry failure and labels error with ts", async () => {
    mockUpsertSchedules.mockResolvedValue({ inserted: 1, updated: 0, skipped: 0 });
    mockUpsertAppointments
      .mockRejectedValueOnce(new Error("boom on entry 1"))
      .mockResolvedValue({ inserted: 1, updated: 0, skipped: 0 });
    mockUpsertWorkPeriods.mockResolvedValue({ inserted: 0, updated: 0, skipped: 0 });

    const service = new DoctoraliaCalendarSyncService();
    const entries = [
      { ts: "2026-04-10", data: makeResponse({ appointmentIds: [10] }) },
      { ts: "2026-04-17", data: makeResponse({ appointmentIds: [20] }) },
    ];

    const result = await service.importFromJsonEntries(entries);

    expect(result.entriesProcessed).toBe(2);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain("entry #1");
    expect(result.errors[0]).toContain("ts=2026-04-10");
    expect(result.errors[0]).toContain("boom on entry 1");
    expect(result.summary.appointments.inserted).toBe(1);
  });

  it("skips schedule upsert when entry has no schedules", async () => {
    mockUpsertAppointments.mockResolvedValue({ inserted: 0, updated: 0, skipped: 0 });
    mockUpsertWorkPeriods.mockResolvedValue({ inserted: 0, updated: 0, skipped: 0 });

    const service = new DoctoraliaCalendarSyncService();
    const empty = makeResponse();
    empty.schedules = {};

    const result = await service.importFromJsonEntries([{ data: empty }]);

    expect(mockUpsertSchedules).not.toHaveBeenCalled();
    expect(result.entriesProcessed).toBe(1);
    expect(result.errors).toEqual([]);
  });

  it("groups appointments by scheduleId before upsert", async () => {
    mockUpsertSchedules.mockResolvedValue({ inserted: 1, updated: 0, skipped: 0 });
    mockUpsertAppointments.mockResolvedValue({ inserted: 1, updated: 0, skipped: 0 });
    mockUpsertWorkPeriods.mockResolvedValue({ inserted: 0, updated: 0, skipped: 0 });

    const service = new DoctoraliaCalendarSyncService();
    const response = makeResponse({ scheduleId: 500, appointmentIds: [1, 2] });
    response.appointments[0]!.scheduleId = 500;
    response.appointments[1]!.scheduleId = 501;
    response.schedules["501"] = { ...response.schedules["500"]!, id: 501 };

    await service.importFromJsonEntries([{ data: response }]);

    expect(mockUpsertAppointments).toHaveBeenCalledTimes(2);
    const calls = mockUpsertAppointments.mock.calls.map((c: unknown[]) => c[0]);
    expect(calls.sort()).toEqual([500, 501]);
  });
});
