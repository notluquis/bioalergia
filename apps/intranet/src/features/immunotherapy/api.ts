import type {
  CreateBudgetInput,
  CreateImmunoAdministrationInput,
  CreateProductInput,
  CreateScitPrescriptionInput,
  HideableSection,
  MarkIspReportedInput,
  PrescriptionPdfInput,
  QuoteInput,
  UpdateProductInput,
} from "@finanzas/orpc-contracts/immunotherapy";
import { immunotherapyORPCClient, toImmunotherapyApiError } from "./orpc";

export async function listImmunoProducts() {
  try {
    const res = await immunotherapyORPCClient.listProducts();
    return res.products;
  } catch (error) {
    throw toImmunotherapyApiError(error);
  }
}

export async function createImmunoProduct(input: CreateProductInput) {
  try {
    const res = await immunotherapyORPCClient.createProduct(input);
    return res.product;
  } catch (error) {
    throw toImmunotherapyApiError(error);
  }
}

export async function updateImmunoProduct(input: UpdateProductInput) {
  try {
    const res = await immunotherapyORPCClient.updateProduct(input);
    return res.product;
  } catch (error) {
    throw toImmunotherapyApiError(error);
  }
}

export async function deleteImmunoProduct(id: number) {
  try {
    return await immunotherapyORPCClient.deleteProduct({ id });
  } catch (error) {
    throw toImmunotherapyApiError(error);
  }
}

export async function listImmunoAllergens(q?: string) {
  try {
    const res = await immunotherapyORPCClient.listAllergens(q ? { q } : {});
    return res.allergens;
  } catch (error) {
    throw toImmunotherapyApiError(error);
  }
}

export async function quoteImmunotherapy(input: QuoteInput) {
  try {
    return await immunotherapyORPCClient.quote(input);
  } catch (error) {
    throw toImmunotherapyApiError(error);
  }
}

export async function createImmunoBudget(input: CreateBudgetInput) {
  try {
    return await immunotherapyORPCClient.createBudget(input);
  } catch (error) {
    throw toImmunotherapyApiError(error);
  }
}

// ── Prescripciones SCIT (trazabilidad por paciente) ──────────────────
export async function createScitPrescription(input: CreateScitPrescriptionInput) {
  try {
    return await immunotherapyORPCClient.createScitPrescription(input);
  } catch (error) {
    throw toImmunotherapyApiError(error);
  }
}

export async function listScitPrescriptions(patientId: number) {
  try {
    const res = await immunotherapyORPCClient.listScitPrescriptions({ patientId });
    return res.items;
  } catch (error) {
    throw toImmunotherapyApiError(error);
  }
}

// ── Carnet de inmunoterapia (administración de dosis) ────────────────
export async function createImmunoAdministration(input: CreateImmunoAdministrationInput) {
  try {
    return await immunotherapyORPCClient.createImmunoAdministration(input);
  } catch (error) {
    throw toImmunotherapyApiError(error);
  }
}

export async function listImmunoAdministrations(patientId: number) {
  try {
    const res = await immunotherapyORPCClient.listImmunoAdministrations({ patientId });
    return res.items;
  } catch (error) {
    throw toImmunotherapyApiError(error);
  }
}

// ── Farmacovigilancia (RAM → ISP) ────────────────────────────────────
export async function listAdverseReactions() {
  try {
    const res = await immunotherapyORPCClient.listAdverseReactions();
    return res.items;
  } catch (error) {
    throw toImmunotherapyApiError(error);
  }
}

export async function markIspReported(input: MarkIspReportedInput) {
  try {
    return await immunotherapyORPCClient.markIspReported(input);
  } catch (error) {
    throw toImmunotherapyApiError(error);
  }
}

export async function getImmunoTerms() {
  try {
    return await immunotherapyORPCClient.getTerms();
  } catch (error) {
    throw toImmunotherapyApiError(error);
  }
}

export async function updateImmunoTerms(input: {
  legalName?: string | null;
  legalRut?: string | null;
  immunoBudgetTerms?: string | null;
  immunoBudgetIntro?: string | null;
}) {
  try {
    return await immunotherapyORPCClient.updateTerms(input);
  } catch (error) {
    throw toImmunotherapyApiError(error);
  }
}

// Genera el PDF (server-side) y dispara la descarga en el navegador.
export async function downloadImmunoBudgetPdf(input: CreateBudgetInput): Promise<void> {
  try {
    const file = await immunotherapyORPCClient.generatePdf(input);
    const blob = file instanceof Blob ? file : new Blob([file as BlobPart]);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = file instanceof File && file.name ? file.name : "presupuesto_inmunoterapia.pdf";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (error) {
    throw toImmunotherapyApiError(error);
  }
}

/**
 * Prescripción para el paciente = PDF del plan de inmunoterapia SIN precios.
 * Reusa el generador del presupuesto forzando ocultar precios + descuento (es el
 * mismo plan comercial que la cotización, presentado como prescripción).
 */
export async function downloadImmunoPatientPrescriptionPdf(
  input: CreateBudgetInput
): Promise<void> {
  const hidden = new Set<HideableSection>(input.hiddenSections ?? []);
  hidden.add("prices");
  hidden.add("discount");
  const planOnly: CreateBudgetInput = { ...input, hiddenSections: Array.from(hidden) };
  try {
    const file = await immunotherapyORPCClient.generatePdf(planOnly);
    const blob = file instanceof Blob ? file : new Blob([file as BlobPart]);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "prescripcion_inmunoterapia.pdf";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (error) {
    throw toImmunotherapyApiError(error);
  }
}

export async function downloadImmunoPrescriptionPdf(input: PrescriptionPdfInput): Promise<void> {
  try {
    const file = await immunotherapyORPCClient.generatePrescriptionPdf(input);
    const blob = file instanceof Blob ? file : new Blob([file as BlobPart]);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = file instanceof File && file.name ? file.name : "receta_inmunoterapia.pdf";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (error) {
    throw toImmunotherapyApiError(error);
  }
}
