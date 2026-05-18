/**
 * Component tests for CreateExamReportWizard create vs edit mode.
 *
 * Pattern: hoisted mocks for the orpc client + the PDF downloader (the
 * latter is async + DOM-y and would just fail in jsdom). Each test
 * mounts the wizard inside a fresh QueryClientProvider so React Query
 * state doesn't leak between cases.
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const orpcMocks = vi.hoisted(() => ({
  list: vi.fn(),
  get: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  markGenerated: vi.fn(),
  listTemplates: vi.fn(),
  getClinicSettings: vi.fn(),
  listAllergens: vi.fn(),
  latestPatientControls: vi.fn(),
}));

vi.mock("../orpc", () => ({
  examReportsORPCClient: orpcMocks,
  toExamReportsApiError: (e: unknown) => (e instanceof Error ? e : new Error(String(e))),
}));

vi.mock("../lib/pdf", () => ({
  downloadExamReportPdf: vi.fn().mockResolvedValue(undefined),
}));

const toastMock = vi.hoisted(() => ({
  success: vi.fn<(msg: string, title?: string) => void>(),
  error: vi.fn<(msg: unknown, title?: string) => void>(),
  info: vi.fn<(msg: string, title?: string) => void>(),
}));

vi.mock("@/context/ToastContext", () => ({
  useToast: () => toastMock,
}));

const { CreateExamReportWizard } = await import("./CreateExamReportWizard");
import type { InitialReportSeed } from "../hooks/use-exam-report-form-state";

const sampleAllergens = [
  {
    id: "all_1",
    commonName: "Dermatofagoides",
    scientificName: null,
    category: "Acaros",
    pollenType: null,
    tags: [],
  },
];

const sampleSettings = {
  id: 1,
  name: "Bioalergia",
  address: "calle x",
  phoneWhatsapp: "+56",
  phoneLandline: "+56",
  email: "x@x.cl",
  website: "https://x",
  websiteSecondary: "",
  defaultReagents: "Histamina 1mg/mL",
  defaultTechnique: "Prick",
  doctorName: "Dr. Default",
  doctorSpecialty: "Inmunología",
  doctorRut: "12.345.678-9",
  signatureUrl: null,
  papuleThresholdMm: 3,
  superintendenciaNumber: null,
  updatedAt: "2026-05-18T00:00:00Z",
};

const baseInitial: InitialReportSeed & {
  patient: {
    id: number;
    birthDate: string | null;
    person: {
      names: string;
      fatherName: string | null;
      motherName: string | null;
      rut: string | null;
    };
  };
} = {
  id: 42,
  examType: "MULTITEST_PANELS",
  conclusionText: "Piel reactiva valida el examen.",
  conclusionTemplateId: null,
  notes: "Nota persistida",
  histamineMm: 5.5,
  salineMm: 0,
  doctorName: "Dra. Persistida",
  doctorSpecialty: "Inmunología",
  doctorRut: "11.111.111-1",
  reagents: null,
  technique: null,
  patient: {
    id: 99,
    birthDate: "1990-01-01",
    person: {
      names: "Ana",
      fatherName: "Pérez",
      motherName: "Soto",
      rut: "9.999.999-9",
    },
  },
  sections: [
    {
      sectionKey: "panel_1",
      label: "Panel 1",
      reactions: [
        {
          allergenId: "all_1",
          reaction: "FUERTE",
          papuleMm: 7,
          allergen: { commonName: "Dermatofagoides" },
        },
      ],
    },
  ],
};

const samplePatient = {
  id: 99,
  birthDate: "1990-01-01" as string | null,
  person: {
    names: "Ana",
    fatherName: "Pérez",
    motherName: "Soto",
    rut: "9.999.999-9",
  },
} as Parameters<typeof CreateExamReportWizard>[0]["patient"];

function buildWrapper() {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  orpcMocks.listTemplates.mockResolvedValue({ templates: [] });
  orpcMocks.getClinicSettings.mockResolvedValue(sampleSettings);
  orpcMocks.listAllergens.mockResolvedValue({
    allergens: sampleAllergens,
    categories: ["Acaros"],
  });
  orpcMocks.latestPatientControls.mockResolvedValue({
    histamineMm: null,
    salineMm: null,
    testDate: null,
    skinTestId: null,
  });
});

describe("CreateExamReportWizard — create mode", () => {
  it("renders 'Nuevo Informe' heading with patient full name", async () => {
    const Wrapper = buildWrapper();
    render(<CreateExamReportWizard isOpen onClose={() => undefined} patient={samplePatient} />, {
      wrapper: Wrapper,
    });
    const heading = await screen.findByTestId("exam-report-wizard-heading");
    expect(heading.textContent).toMatch(/Nuevo Informe/);
    expect(heading.textContent).toMatch(/Ana/);
  });

  it("prefills control chip with XLSX origin when latest-controls returns values", async () => {
    orpcMocks.latestPatientControls.mockResolvedValue({
      histamineMm: 6,
      salineMm: 0,
      testDate: "2026-05-10",
      skinTestId: "st_1",
    });
    const Wrapper = buildWrapper();
    const user = userEvent.setup();
    render(<CreateExamReportWizard isOpen onClose={() => undefined} patient={samplePatient} />, {
      wrapper: Wrapper,
    });
    // Advance to step 2 (allergens + controls block).
    await user.click(await screen.findByRole("tab", { name: "2. Alérgenos" }));
    const chip = await screen.findByTestId("control-histamine-source-chip");
    expect(chip.textContent).toMatch(/XLSX 2026-05-10/);
  });
});

describe("CreateExamReportWizard — edit mode", () => {
  it("renders 'Editar informe' heading and pre-seeded sections", async () => {
    const Wrapper = buildWrapper();
    render(
      <CreateExamReportWizard isOpen onClose={() => undefined} initialReport={baseInitial} />,
      { wrapper: Wrapper }
    );
    const heading = await screen.findByTestId("exam-report-wizard-heading");
    expect(heading.textContent).toMatch(/Editar informe/);
    expect(heading.textContent).toMatch(/Ana/);
  });

  it("disables step-1 tab (exam-type is immutable post-create)", async () => {
    const Wrapper = buildWrapper();
    render(
      <CreateExamReportWizard isOpen onClose={() => undefined} initialReport={baseInitial} />,
      { wrapper: Wrapper }
    );
    const tab = await screen.findByRole("tab", { name: "1. Tipo" });
    // React Aria disables the tab via aria-disabled, not the native attr.
    expect(tab.getAttribute("aria-disabled")).toBe("true");
  });

  it("shows 'informe persistido' chip when control values rehydrate from initialReport", async () => {
    const Wrapper = buildWrapper();
    const user = userEvent.setup();
    render(
      <CreateExamReportWizard isOpen onClose={() => undefined} initialReport={baseInitial} />,
      { wrapper: Wrapper }
    );
    await user.click(await screen.findByRole("tab", { name: "2. Alérgenos" }));
    const chip = await screen.findByTestId("control-histamine-source-chip");
    expect(chip.textContent).toMatch(/informe persistido/);
  });

  it("submit calls updateExamReport with id + patched fields (NOT create)", async () => {
    orpcMocks.update.mockResolvedValue({ ...baseInitial, sections: [] });
    const Wrapper = buildWrapper();
    const user = userEvent.setup();
    render(
      <CreateExamReportWizard isOpen onClose={() => undefined} initialReport={baseInitial} />,
      { wrapper: Wrapper }
    );
    // Navigate to step 4 and submit.
    await user.click(await screen.findByRole("tab", { name: "4. Revisar" }));
    const submitBtn = await screen.findByTestId("exam-report-wizard-submit");
    await user.click(submitBtn);
    await waitFor(() => expect(orpcMocks.update).toHaveBeenCalled());
    expect(orpcMocks.create).not.toHaveBeenCalled();
    const arg = orpcMocks.update.mock.calls[0]?.[0];
    expect(arg).toMatchObject({
      id: 42,
      conclusionText: "Piel reactiva valida el examen.",
      histamineMm: 5.5,
      salineMm: 0,
      doctorName: "Dra. Persistida",
    });
    expect(arg.sections).toHaveLength(1);
  });
});
