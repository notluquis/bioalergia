import { describe, expect, it } from "vitest";
import type { TimesheetEntryWithEmployee } from "../types";
import { detectOverlapsForDate, getOverlappingEmployeesForDate } from "./overlap-detection";

function makeEntry(
  overrides: Partial<TimesheetEntryWithEmployee> & {
    employee_id: number;
    start_time: string;
    end_time: string;
  }
): TimesheetEntryWithEmployee {
  return {
    comment: null,
    employee_name: `Employee ${overrides.employee_id}`,
    employee_role: null,
    id: overrides.employee_id,
    overtime_minutes: 0,
    work_date: "2026-01-10",
    worked_minutes: 480,
    ...overrides,
  };
}

describe("overlap-detection — extra branch coverage", () => {
  it("treats 'Tecnico de Enfermeria' as TENS-compatible with nurse", () => {
    const entries = [
      makeEntry({
        employee_id: 1,
        start_time: "08:00",
        end_time: "16:00",
        employee_role: "Enfermera Universitaria",
      }),
      makeEntry({
        employee_id: 2,
        start_time: "08:00",
        end_time: "16:00",
        employee_role: "Técnico de Enfermería",
      }),
    ];
    expect(detectOverlapsForDate(entries, "2026-01-10")).toHaveLength(0);
  });

  it("treats 'Tecnica en Enfermeria' as TENS-compatible with nurse", () => {
    const entries = [
      makeEntry({
        employee_id: 1,
        start_time: "08:00",
        end_time: "16:00",
        employee_role: "Enfermero Universitario",
      }),
      makeEntry({
        employee_id: 2,
        start_time: "08:00",
        end_time: "16:00",
        employee_role: "Técnica en Enfermería",
      }),
    ];
    expect(detectOverlapsForDate(entries, "2026-01-10")).toHaveLength(0);
  });

  it("getOverlappingEmployeesForDate returns empty when no entries on date", () => {
    const entries = [makeEntry({ employee_id: 1, start_time: "08:00", end_time: "16:00" })];
    expect(getOverlappingEmployeesForDate(entries, "2099-12-31")).toStrictEqual([]);
  });

  it("getOverlappingEmployeesForDate skips compatible nurse + TENS", () => {
    const entries = [
      makeEntry({
        employee_id: 1,
        start_time: "08:00",
        end_time: "16:00",
        employee_role: "Enfermera Universitaria",
      }),
      makeEntry({
        employee_id: 2,
        start_time: "08:00",
        end_time: "16:00",
        employee_role: "TENS",
      }),
    ];
    expect(getOverlappingEmployeesForDate(entries, "2026-01-10")).toStrictEqual([]);
  });

  it("non-medical role with empty string is treated as not nurse / not TENS", () => {
    const entries = [
      makeEntry({
        employee_id: 1,
        start_time: "08:00",
        end_time: "16:00",
        employee_role: "",
      }),
      makeEntry({
        employee_id: 2,
        start_time: "09:00",
        end_time: "12:00",
        employee_role: "",
      }),
    ];
    // Both have empty roles → not compatible → flagged as overlap
    expect(detectOverlapsForDate(entries, "2026-01-10")).toHaveLength(1);
  });
});
