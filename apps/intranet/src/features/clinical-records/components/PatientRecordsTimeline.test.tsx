/**
 * Tests for PatientRecordsTimeline — list view of a patient's clinical records.
 *
 * Mocks the `usePatientClinicalRecords` hook directly because the
 * component is a thin presentational wrapper.
 */
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const hookState = vi.hoisted(() => ({
  current: {
    data: undefined as unknown as { records: unknown[] } | undefined,
    isLoading: false,
  },
}));

vi.mock("../hooks/useClinicalRecords", () => ({
  usePatientClinicalRecords: () => hookState.current,
}));

const { PatientRecordsTimeline } = await import("./PatientRecordsTimeline");

describe("PatientRecordsTimeline", () => {
  beforeEach(() => {
    hookState.current = { data: undefined, isLoading: false };
  });

  it("returns null when patientId is null", () => {
    const { container } = render(<PatientRecordsTimeline patientId={null} />);
    expect(container.firstChild).toBeNull();
  });

  it("shows a spinner while loading", () => {
    hookState.current = { data: undefined, isLoading: true };
    const { container } = render(<PatientRecordsTimeline patientId={42} />);
    // Spinner renders an svg / progressbar role; assert layout container exists
    expect(container.querySelector(".h-32")).not.toBeNull();
  });

  it("renders an empty-state message when no records exist", () => {
    hookState.current = { data: { records: [] }, isLoading: false };
    render(<PatientRecordsTimeline patientId={42} />);
    expect(screen.getByText("Sin fichas clínicas registradas")).toBeInTheDocument();
  });

  it("renders one RecordCard per record", () => {
    hookState.current = {
      isLoading: false,
      data: {
        records: [
          {
            id: 1,
            consultDate: "2026-05-12",
            patientName: "Ana",
            ageLabel: "32 años",
            history: "Rinitis",
            physicalExam: null,
            diagnosis: "RA",
            indications: [],
            antecedents: { personal: [], family: [] },
            medications: [],
            knownAllergies: [],
            observations: null,
            weightKg: null,
            heightCm: null,
            headCircumferenceCm: null,
            anthropometric: {},
          },
          {
            id: 2,
            consultDate: "2026-04-01",
            patientName: "Ana",
            ageLabel: "32 años",
            history: "Control",
            physicalExam: null,
            diagnosis: null,
            indications: [],
            antecedents: { personal: [], family: [] },
            medications: [],
            knownAllergies: [],
            observations: null,
            weightKg: null,
            heightCm: null,
            headCircumferenceCm: null,
            anthropometric: {},
          },
        ],
      },
    };
    render(<PatientRecordsTimeline patientId={1} />);
    expect(screen.getByText("Rinitis")).toBeInTheDocument();
    expect(screen.getByText("Control")).toBeInTheDocument();
  });
});
