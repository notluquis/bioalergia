import Decimal from "decimal.js";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api-client";

import {
  createPatient,
  createPatientBudget,
  createPatientConsultation,
  createPatientPayment,
  fetchPatient,
  fetchPatientBudgets,
  fetchPatientClinicalSeries,
  fetchPatientDteSources,
  fetchPatientPayments,
  fetchPatientSkinTests,
  fetchPatients,
  normalizeDecimalValues,
  syncPatientDteSources,
  uploadPatientAttachment,
} from "./api";
import { patientsORPCClient } from "./orpc";

// Mock the oRPC client. Each method is replaced with a vi.fn() so tests
// can stub responses or throw to exercise the error path. We retain the
// real ApiError mapping in toPatientsApiError indirectly by re-exporting
// a passthrough that still wraps non-ApiError values into ApiError so
// the error-path assertions below stay realistic.
vi.mock("./orpc", async () => {
  const { ApiError: RealApiError } = await import("@/lib/api-client");
  return {
    patientsORPCClient: {
      create: vi.fn(),
      createAttachment: vi.fn(),
      createBudget: vi.fn(),
      createConsultation: vi.fn(),
      createPayment: vi.fn(),
      detail: vi.fn(),
      getClinicalSeries: vi.fn(),
      getSkinTests: vi.fn(),
      list: vi.fn(),
      listBudgets: vi.fn(),
      listDteSources: vi.fn(),
      listPayments: vi.fn(),
      syncDteSources: vi.fn(),
    },
    toPatientsApiError: (error: unknown) => {
      if (error instanceof RealApiError) return error;
      if (error instanceof Error) return new RealApiError(error.message, 500);
      return new RealApiError("Error inesperado", 500, error);
    },
  };
});

const NOW = new Date("2026-05-12T10:00:00.000Z");

function makePerson(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    names: "María José Pérez González",
    fatherName: "Pérez",
    motherName: "González",
    rut: "16.123.456-5",
    email: "maria.perez@example.cl",
    phone: "+56912345678",
    personType: "NATURAL",
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function makePatient(overrides: Record<string, unknown> = {}) {
  return {
    id: 42,
    personId: 1,
    birthDate: "1990-04-15",
    bloodType: "O+",
    notes: null,
    createdAt: NOW,
    updatedAt: NOW,
    person: makePerson(),
    ...overrides,
  };
}

function makeConsultation(overrides: Record<string, unknown> = {}) {
  return {
    id: 7,
    patientId: 42,
    date: "2026-05-01",
    reason: "Control alergia",
    diagnosis: null,
    treatment: null,
    notes: null,
    eventId: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function makePayment(overrides: Record<string, unknown> = {}) {
  return {
    id: 11,
    patientId: 42,
    amount: new Decimal("50000.00"),
    paymentDate: "2026-05-10",
    paymentMethod: "Transferencia",
    reference: null,
    notes: null,
    budgetId: null,
    createdAt: NOW,
    ...overrides,
  };
}

function makeBudget(overrides: Record<string, unknown> = {}) {
  return {
    id: 5,
    patientId: 42,
    title: "Estudio alérgico completo",
    status: "PENDING",
    totalAmount: new Decimal("120000.00"),
    discount: new Decimal("0"),
    finalAmount: new Decimal("120000.00"),
    notes: null,
    createdAt: NOW,
    updatedAt: NOW,
    items: [
      {
        id: 1,
        budgetId: 5,
        description: "Test cutáneo",
        quantity: 1,
        unitPrice: new Decimal("120000.00"),
        totalPrice: new Decimal("120000.00"),
      },
    ],
    ...overrides,
  };
}

function makeAttachment(overrides: Record<string, unknown> = {}) {
  return {
    id: "att_1",
    patientId: 42,
    driveFileId: "drive_xyz",
    name: "examen.pdf",
    type: "EXAM",
    mimeType: "application/pdf",
    uploadedAt: NOW,
    uploadedBy: 9,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("normalizeDecimalValues", () => {
  it("converts Decimal scalars to numbers", () => {
    expect(normalizeDecimalValues(new Decimal("12.5"))).toBe(12.5);
  });

  it("recurses through nested arrays and objects, leaving Dates intact", () => {
    const date = new Date("2026-01-01T00:00:00.000Z");
    const result = normalizeDecimalValues({
      a: [new Decimal("1.1"), { b: new Decimal("2.2"), d: date }],
      n: null,
      s: "x",
    }) as Record<string, unknown>;
    expect(result.s).toBe("x");
    expect(result.n).toBeNull();
    const arr = result.a as Array<unknown>;
    expect(arr[0]).toBe(1.1);
    const inner = arr[1] as Record<string, unknown>;
    expect(inner.b).toBe(2.2);
    expect(inner.d).toBe(date);
  });

  it("returns primitives untouched", () => {
    expect(normalizeDecimalValues(0)).toBe(0);
    expect(normalizeDecimalValues(null)).toBeNull();
    expect(normalizeDecimalValues(undefined)).toBeUndefined();
  });
});

describe("fetchPatient", () => {
  it("parses a valid detail response", async () => {
    vi.mocked(patientsORPCClient.detail).mockResolvedValue({
      patient: {
        ...makePatient(),
        attachments: [makeAttachment()],
        budgets: [makeBudget()],
        consultations: [makeConsultation()],
        medicalCertificates: [],
        payments: [makePayment()],
      },
    } as never);

    const result = await fetchPatient(42);
    expect(result.id).toBe(42);
    expect(result.budgets[0]?.totalAmount).toBe(120000);
    expect(result.payments[0]?.amount).toBe(50000);
    expect(patientsORPCClient.detail).toHaveBeenCalledWith({ patientId: 42 });
  });

  it("wraps client errors with ApiError", async () => {
    vi.mocked(patientsORPCClient.detail).mockRejectedValue(new Error("boom"));
    await expect(fetchPatient(1)).rejects.toBeInstanceOf(ApiError);
  });

  it("throws Zod parse error on schema mismatch", async () => {
    vi.mocked(patientsORPCClient.detail).mockResolvedValue({
      patient: { id: 1 },
    } as never);
    await expect(fetchPatient(1)).rejects.toThrow();
  });
});

describe("fetchPatients", () => {
  it("parses a list of patients (without q)", async () => {
    vi.mocked(patientsORPCClient.list).mockResolvedValue({
      patients: [makePatient(), makePatient({ id: 43 })],
    } as never);
    const result = await fetchPatients();
    expect(result).toHaveLength(2);
    expect(patientsORPCClient.list).toHaveBeenCalledWith({});
  });

  it("forwards q filter when provided", async () => {
    vi.mocked(patientsORPCClient.list).mockResolvedValue({ patients: [] } as never);
    await fetchPatients("Pérez");
    expect(patientsORPCClient.list).toHaveBeenCalledWith({ q: "Pérez" });
  });

  it("returns empty list", async () => {
    vi.mocked(patientsORPCClient.list).mockResolvedValue({ patients: [] } as never);
    expect(await fetchPatients()).toEqual([]);
  });

  it("wraps client errors with ApiError", async () => {
    vi.mocked(patientsORPCClient.list).mockRejectedValue(new Error("nope"));
    await expect(fetchPatients()).rejects.toBeInstanceOf(ApiError);
  });
});

describe("createPatient", () => {
  it("returns parsed patient on success", async () => {
    vi.mocked(patientsORPCClient.create).mockResolvedValue({
      patient: makePatient(),
    } as never);
    const out = await createPatient({ names: "María José Pérez", rut: "16.123.456-5" });
    expect(out.id).toBe(42);
    expect(out.person.rut).toBe("16.123.456-5");
  });

  it("wraps client errors", async () => {
    vi.mocked(patientsORPCClient.create).mockRejectedValue(new Error("dup"));
    await expect(createPatient({ names: "X", rut: "1-9" })).rejects.toBeInstanceOf(ApiError);
  });
});

describe("createPatientBudget", () => {
  it("returns parsed budget", async () => {
    vi.mocked(patientsORPCClient.createBudget).mockResolvedValue({
      budget: makeBudget(),
    } as never);
    const result = await createPatientBudget({
      discount: 0,
      items: [{ description: "Test", quantity: 1, unitPrice: 120000 }],
      patientId: 42,
      title: "Estudio",
    });
    expect(result.finalAmount).toBe(120000);
    expect(result.items[0]?.unitPrice).toBe(120000);
  });

  it("wraps errors", async () => {
    vi.mocked(patientsORPCClient.createBudget).mockRejectedValue(new Error("x"));
    await expect(
      createPatientBudget({ discount: 0, items: [], patientId: 1, title: "t" })
    ).rejects.toBeInstanceOf(ApiError);
  });
});

describe("createPatientConsultation", () => {
  it("returns parsed consultation", async () => {
    vi.mocked(patientsORPCClient.createConsultation).mockResolvedValue({
      consultation: makeConsultation(),
    } as never);
    const result = await createPatientConsultation({
      date: "2026-05-01",
      patientId: 42,
      reason: "Control",
    });
    expect(result.id).toBe(7);
  });

  it("wraps errors", async () => {
    vi.mocked(patientsORPCClient.createConsultation).mockRejectedValue(new Error("x"));
    await expect(
      createPatientConsultation({ date: "2026-05-01", patientId: 42, reason: "r" })
    ).rejects.toBeInstanceOf(ApiError);
  });
});

describe("createPatientPayment", () => {
  it("returns parsed payment", async () => {
    vi.mocked(patientsORPCClient.createPayment).mockResolvedValue({
      payment: makePayment(),
    } as never);
    const result = await createPatientPayment({
      amount: 50000,
      patientId: 42,
      paymentDate: "2026-05-10",
      paymentMethod: "Transferencia",
    });
    expect(result.amount).toBe(50000);
  });

  it("wraps errors", async () => {
    vi.mocked(patientsORPCClient.createPayment).mockRejectedValue(new Error("x"));
    await expect(
      createPatientPayment({
        amount: 1,
        patientId: 1,
        paymentDate: "2026-01-01",
        paymentMethod: "Efectivo",
      })
    ).rejects.toBeInstanceOf(ApiError);
  });
});

describe("uploadPatientAttachment", () => {
  it("uploads a File and returns a parsed attachment, defaulting name", async () => {
    vi.mocked(patientsORPCClient.createAttachment).mockResolvedValue({
      attachment: makeAttachment(),
    } as never);
    const file = new File(["data"], "examen.pdf", { type: "application/pdf" });
    const result = await uploadPatientAttachment({
      file,
      patientId: "42",
      type: "EXAM",
    });
    expect(result.driveFileId).toBe("drive_xyz");
    expect(patientsORPCClient.createAttachment).toHaveBeenCalledWith({
      file,
      name: "examen.pdf",
      patientId: 42,
      type: "EXAM",
    });
  });

  it("uses provided name override when given", async () => {
    vi.mocked(patientsORPCClient.createAttachment).mockResolvedValue({
      attachment: makeAttachment({ name: "custom.pdf" }),
    } as never);
    const file = new File(["data"], "x.pdf", { type: "application/pdf" });
    await uploadPatientAttachment({
      file,
      name: "custom.pdf",
      patientId: "42",
      type: "EXAM",
    });
    expect(patientsORPCClient.createAttachment).toHaveBeenCalledWith({
      file,
      name: "custom.pdf",
      patientId: 42,
      type: "EXAM",
    });
  });

  it("wraps client errors", async () => {
    vi.mocked(patientsORPCClient.createAttachment).mockRejectedValue(new Error("io"));
    const file = new File(["x"], "x.pdf");
    await expect(
      uploadPatientAttachment({ file, patientId: "1", type: "EXAM" })
    ).rejects.toBeInstanceOf(ApiError);
  });
});

describe("fetchPatientBudgets", () => {
  it("parses budgets list with Decimal normalization", async () => {
    vi.mocked(patientsORPCClient.listBudgets).mockResolvedValue({
      budgets: [makeBudget()],
    } as never);
    const out = await fetchPatientBudgets(42);
    expect(out[0]?.totalAmount).toBe(120000);
  });

  it("returns empty list", async () => {
    vi.mocked(patientsORPCClient.listBudgets).mockResolvedValue({ budgets: [] } as never);
    expect(await fetchPatientBudgets(42)).toEqual([]);
  });

  it("wraps errors", async () => {
    vi.mocked(patientsORPCClient.listBudgets).mockRejectedValue(new Error("x"));
    await expect(fetchPatientBudgets(42)).rejects.toBeInstanceOf(ApiError);
  });
});

describe("fetchPatientPayments", () => {
  it("parses payments list", async () => {
    vi.mocked(patientsORPCClient.listPayments).mockResolvedValue({
      payments: [makePayment()],
    } as never);
    const out = await fetchPatientPayments(42);
    expect(out[0]?.amount).toBe(50000);
  });

  it("wraps errors", async () => {
    vi.mocked(patientsORPCClient.listPayments).mockRejectedValue(new Error("x"));
    await expect(fetchPatientPayments(42)).rejects.toBeInstanceOf(ApiError);
  });
});

describe("fetchPatientDteSources", () => {
  it("returns normalized rows with default empty input", async () => {
    vi.mocked(patientsORPCClient.listDteSources).mockResolvedValue({
      rows: [{ amount: new Decimal("1000.50"), id: 1 }],
    } as never);
    const out = (await fetchPatientDteSources()) as Array<{ amount: number; id: number }>;
    expect(out[0]?.amount).toBe(1000.5);
    expect(patientsORPCClient.listDteSources).toHaveBeenCalledWith({});
  });

  it("forwards filter parameters", async () => {
    vi.mocked(patientsORPCClient.listDteSources).mockResolvedValue({ rows: [] } as never);
    await fetchPatientDteSources({ limit: 10, period: "2026-05", q: "MARIA" });
    expect(patientsORPCClient.listDteSources).toHaveBeenCalledWith({
      limit: 10,
      period: "2026-05",
      q: "MARIA",
    });
  });

  it("wraps errors", async () => {
    vi.mocked(patientsORPCClient.listDteSources).mockRejectedValue(new Error("x"));
    await expect(fetchPatientDteSources()).rejects.toBeInstanceOf(ApiError);
  });
});

describe("syncPatientDteSources", () => {
  it("returns the raw client response", async () => {
    const response = { matched: 3, processed: 5 };
    vi.mocked(patientsORPCClient.syncDteSources).mockResolvedValue(response as never);
    const out = await syncPatientDteSources({ dryRun: true, limit: 10, period: "2026-05" });
    expect(out).toBe(response);
  });

  it("wraps errors", async () => {
    vi.mocked(patientsORPCClient.syncDteSources).mockRejectedValue(new Error("x"));
    await expect(syncPatientDteSources({})).rejects.toBeInstanceOf(ApiError);
  });
});

describe("fetchPatientClinicalSeries", () => {
  it("returns the raw client response", async () => {
    const series = { points: [{ t: NOW, v: 1 }] };
    vi.mocked(patientsORPCClient.getClinicalSeries).mockResolvedValue(series as never);
    expect(await fetchPatientClinicalSeries(42)).toBe(series);
    expect(patientsORPCClient.getClinicalSeries).toHaveBeenCalledWith({ patientId: 42 });
  });

  it("wraps errors", async () => {
    vi.mocked(patientsORPCClient.getClinicalSeries).mockRejectedValue(new Error("x"));
    await expect(fetchPatientClinicalSeries(42)).rejects.toBeInstanceOf(ApiError);
  });
});

describe("fetchPatientSkinTests", () => {
  it("returns the raw client response", async () => {
    const tests = { rows: [] };
    vi.mocked(patientsORPCClient.getSkinTests).mockResolvedValue(tests as never);
    expect(await fetchPatientSkinTests(42)).toBe(tests);
  });

  it("wraps errors", async () => {
    vi.mocked(patientsORPCClient.getSkinTests).mockRejectedValue(new Error("x"));
    await expect(fetchPatientSkinTests(42)).rejects.toBeInstanceOf(ApiError);
  });
});

describe("ApiError passthrough", () => {
  it("does not double-wrap an existing ApiError", async () => {
    const original = new ApiError("forbidden", 403);
    vi.mocked(patientsORPCClient.detail).mockRejectedValue(original);
    await expect(fetchPatient(1)).rejects.toBe(original);
  });
});
