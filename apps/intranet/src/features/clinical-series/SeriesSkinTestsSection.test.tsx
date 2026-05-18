/**
 * Tests for SeriesSkinTestsSection — collapsible disclosure rendering
 * skin tests + clinical documents under a clinical series detail view.
 *
 * Mocks the two queries used by the component, asserts:
 *  - returns null when both lists are empty,
 *  - shows a spinner while loading,
 *  - renders a chip per test result with the trimming label "+N más",
 *  - exposes a data-phi-block boundary on each rendered test card.
 */
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  tests: {
    data: undefined as unknown as undefined | unknown[],
    isLoading: false,
  },
  documents: {
    data: undefined as unknown as undefined | unknown[],
    isLoading: false,
  },
}));

vi.mock("./skin-tests-queries", () => ({
  useSkinTestsBySeries: () => state.tests,
  useClinicalDocumentsBySeries: () => state.documents,
}));

const { SeriesSkinTestsSection } = await import("./SeriesSkinTestsSection");

describe("SeriesSkinTestsSection", () => {
  beforeEach(() => {
    state.tests = { data: undefined, isLoading: false };
    state.documents = { data: undefined, isLoading: false };
  });

  it("returns null when no tests and no documents", () => {
    state.tests = { data: [], isLoading: false };
    state.documents = { data: [], isLoading: false };
    const { container } = render(<SeriesSkinTestsSection seriesId={1} />);
    expect(container.firstChild).toBeNull();
  });

  it("shows spinner while either query is loading", () => {
    state.tests = { data: undefined, isLoading: true };
    state.documents = { data: undefined, isLoading: false };
    const { container } = render(<SeriesSkinTestsSection seriesId={1} />);
    expect(container.querySelector(".py-4")).not.toBeNull();
  });

  it("renders skin test test-date chip + result count + PHI boundary", () => {
    state.tests = {
      isLoading: false,
      data: [
        {
          id: 1,
          testDate: "2026-05-12",
          panelTitle: "Aeroalérgenos",
          nonConclusiveDueToHyperreactivity: false,
          clinicalNote: null,
          physicianName: null,
          physicianSpecialty: null,
          website: null,
          address: null,
          oneDriveWebUrl: null,
          results: [
            {
              section: "AEROALERGENOS",
              code: "D1",
              allergenName: "Dermatophagoides pteronyssinus",
              papuleMm: 7,
              erythemaMm: 12,
              rawPapule: null,
              rawErythema: null,
              sortOrder: 1,
            },
          ],
        },
      ],
    };
    state.documents = { data: [], isLoading: false };

    const { container } = render(<SeriesSkinTestsSection seriesId={1} />);
    expect(screen.getByText("2026-05-12")).toBeInTheDocument();
    expect(screen.getByText("Aeroalérgenos")).toBeInTheDocument();
    expect(screen.getByText("1 resultados")).toBeInTheDocument();
    expect(container.querySelector("[data-phi-block]")).not.toBeNull();
  });

  it("flags hyperreactivity with 'No concluyente' chip", () => {
    state.tests = {
      isLoading: false,
      data: [
        {
          id: 1,
          testDate: "2026-05-12",
          panelTitle: null,
          nonConclusiveDueToHyperreactivity: true,
          clinicalNote: null,
          physicianName: null,
          physicianSpecialty: null,
          website: null,
          address: null,
          oneDriveWebUrl: null,
          results: [],
        },
      ],
    };
    state.documents = { data: [], isLoading: false };
    render(<SeriesSkinTestsSection seriesId={1} />);
    expect(screen.getByText("No concluyente")).toBeInTheDocument();
  });

  it("shows '+N más' summary when results exceed 10", () => {
    const results = Array.from({ length: 13 }).map((_, i) => ({
      section: "AERO",
      code: `C${i}`,
      allergenName: `Allergen ${i}`,
      papuleMm: i,
      erythemaMm: i + 1,
      rawPapule: null,
      rawErythema: null,
      sortOrder: i,
    }));
    state.tests = {
      isLoading: false,
      data: [
        {
          id: 1,
          testDate: "2026-05-12",
          panelTitle: null,
          nonConclusiveDueToHyperreactivity: false,
          clinicalNote: null,
          physicianName: null,
          physicianSpecialty: null,
          website: null,
          address: null,
          oneDriveWebUrl: null,
          results,
        },
      ],
    };
    state.documents = { data: [], isLoading: false };
    render(<SeriesSkinTestsSection seriesId={1} />);
    expect(screen.getByText("+3 resultados más")).toBeInTheDocument();
  });

  it("renders a document entry with kind label + filename", () => {
    state.tests = { data: [], isLoading: false };
    state.documents = {
      isLoading: false,
      data: [
        {
          id: "doc_1",
          documentKind: "CLINICAL_RECORD",
          filename: "PEREZ_ANA_2026-05-12.xlsx",
          oneDriveWebUrl: null,
          extractedPatientName: "Ana Pérez",
          accountEmail: "operador@bioalergia.cl",
          modifiedAt: "2026-05-12T10:00:00.000Z",
          path: "/Fichas/2026/",
        },
      ],
    };
    render(<SeriesSkinTestsSection seriesId={1} />);
    expect(screen.getByText("Ficha clínica")).toBeInTheDocument();
    expect(screen.getByText("PEREZ_ANA_2026-05-12.xlsx")).toBeInTheDocument();
    expect(screen.getByText("Ana Pérez")).toBeInTheDocument();
  });
});
