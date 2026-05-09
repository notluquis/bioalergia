import fs from "node:fs";
import path from "node:path";
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

const FIXTURE_PATH =
  process.env.DOCTORALIA_CALENDAR_FIXTURE ??
  "/Users/notluquis/Downloads/calendarevents_bioalergia_2026-04-17.json";

const fileExists = fs.existsSync(FIXTURE_PATH);

describe.skipIf(!fileExists)(
  "DoctoraliaCalendarSyncService smoke test against scraped JSON",
  () => {
    beforeEach(() => {
      mockUpsertSchedules.mockReset();
      mockUpsertAppointments.mockReset();
      mockUpsertWorkPeriods.mockReset();
      mockUpsertSchedules.mockResolvedValue({ inserted: 0, updated: 0, skipped: 0 });
      mockUpsertAppointments.mockImplementation(
        async (_scheduleId: number, appts: unknown[]) => ({
          inserted: Array.isArray(appts) ? appts.length : 0,
          updated: 0,
          skipped: 0,
        }),
      );
      mockUpsertWorkPeriods.mockImplementation(async (_scheduleId: number, wps: unknown[]) => ({
        inserted: Array.isArray(wps) ? wps.length : 0,
        updated: 0,
        skipped: 0,
      }));
    });

    it("processes the first 3 scraped entries end-to-end", async () => {
      const raw = JSON.parse(fs.readFileSync(path.resolve(FIXTURE_PATH), "utf8"));
      const allEntries: Array<{ ts?: string; data: unknown }> = Array.isArray(raw)
        ? raw
        : raw.entries;

      expect(allEntries.length).toBeGreaterThan(0);

      const sample = allEntries.slice(0, 3).map((e) => ({
        ts: e.ts,
        data: e.data as DoctoraliaCalendarResponse,
      }));

      const service = new DoctoraliaCalendarSyncService();
      const result = await service.importFromJsonEntries(sample);

      expect(result.entriesProcessed).toBe(3);
      expect(result.errors).toEqual([]);
      expect(mockUpsertSchedules).toHaveBeenCalled();
      expect(mockUpsertAppointments).toHaveBeenCalled();

      const totalAppointments = sample.reduce(
        (sum, e) => sum + ((e.data as { appointments: unknown[] }).appointments?.length ?? 0),
        0,
      );
      expect(result.summary.appointments.inserted).toBe(totalAppointments);
    });
  },
);
