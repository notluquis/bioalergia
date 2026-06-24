import type { CreateOccOrderInput } from "@finanzas/orpc-contracts/occupational-testing";
import { occTestingORPCClient, toOccTestingApiError } from "./orpc";
import { OccTestingSchemas } from "./schemas";
import type { OccCustodyAction, OccMatrix, OccSampleKind } from "./schemas";

// ── Query keys ────────────────────────────────────────────────────────
export const occTestingKeys = {
  all: ["occupational-testing"] as const,
  orders: (programId?: number) => [...occTestingKeys.all, "orders", programId ?? "all"] as const,
  order: (orderId: number) => [...occTestingKeys.all, "order", orderId] as const,
};

// ── Sujeto pseudónimo (código de barras, NO nombre/RUT) ────────────────
export async function createSubject(input: { subjectCode: string; personId?: number | null }) {
  try {
    const res = await occTestingORPCClient.createSubject(input);
    return OccTestingSchemas.SubjectResponse.parse(res).subject;
  } catch (error) {
    throw toOccTestingApiError(error);
  }
}

// ── Órdenes ───────────────────────────────────────────────────────────
export async function createOrder(input: CreateOccOrderInput) {
  try {
    const res = await occTestingORPCClient.createOrder(input);
    return OccTestingSchemas.OrderResponse.parse(res).order;
  } catch (error) {
    throw toOccTestingApiError(error);
  }
}

export async function listOrders(programId?: number) {
  try {
    const res = await occTestingORPCClient.listOrders({ programId });
    return OccTestingSchemas.OrderListResponse.parse(res).orders;
  } catch (error) {
    throw toOccTestingApiError(error);
  }
}

export async function getOrder(orderId: number) {
  try {
    const res = await occTestingORPCClient.getOrder({ orderId });
    return OccTestingSchemas.OrderDetailResponse.parse(res);
  } catch (error) {
    throw toOccTestingApiError(error);
  }
}

// ── Muestras ──────────────────────────────────────────────────────────
export async function addSample(input: {
  orderId: number;
  kind: OccSampleKind;
  containerCode: string;
  matrix?: OccMatrix;
  sealId?: string | null;
  primaryAliquotOf?: number | null;
}) {
  try {
    const res = await occTestingORPCClient.addSample(input);
    return OccTestingSchemas.SampleResponse.parse(res).sample;
  } catch (error) {
    throw toOccTestingApiError(error);
  }
}

// ── Cadena de custodia (append-only) ──────────────────────────────────
export async function addCustodyEvent(input: {
  orderId: number;
  sampleId?: number | null;
  action: OccCustodyAction;
  actorRole?: string | null;
  signatureRef?: string | null;
  sealIntact?: boolean | null;
  location?: string | null;
  notes?: string | null;
}) {
  try {
    const res = await occTestingORPCClient.addCustodyEvent(input);
    return OccTestingSchemas.CustodyEventResponse.parse(res).event;
  } catch (error) {
    throw toOccTestingApiError(error);
  }
}

// ── Tamizaje (nunca "positivo": NEGATIVE | PRESUMPTIVE_POSITIVE) ───────
export async function recordScreening(input: {
  orderId: number;
  method?: string;
  panel: unknown[];
  outcome: "NEGATIVE" | "PRESUMPTIVE_POSITIVE";
  labId?: string | null;
}) {
  try {
    const res = await occTestingORPCClient.recordScreening(input);
    return OccTestingSchemas.OrderResponse.parse(res).order;
  } catch (error) {
    throw toOccTestingApiError(error);
  }
}

// ── Confirmatorio (GC-MS / LC-MS-MS; NEGATIVE | POSITIVE) ──────────────
export async function recordConfirmatory(input: {
  orderId: number;
  method: "GC_MS" | "LC_MS_MS";
  sampleId: number;
  analytes: unknown[];
  outcome: "NEGATIVE" | "POSITIVE";
  confirmingLabId?: string | null;
  isoAccredited?: boolean;
}) {
  try {
    const res = await occTestingORPCClient.recordConfirmatory(input);
    return OccTestingSchemas.OrderResponse.parse(res).order;
  } catch (error) {
    throw toOccTestingApiError(error);
  }
}

// ── Revisión médica (solo tras POSITIVO confirmado) ───────────────────
export async function recordMedicalReview(input: {
  orderId: number;
  declaredMeds?: unknown[] | null;
  decision: "CONFIRMED_POSITIVE" | "EXPLAINED_BY_RX";
  rationale: string;
}) {
  try {
    const res = await occTestingORPCClient.recordMedicalReview(input);
    return OccTestingSchemas.OrderResponse.parse(res).order;
  } catch (error) {
    throw toOccTestingApiError(error);
  }
}

// ── Consentimientos ───────────────────────────────────────────────────
export async function recordConsent(input: {
  orderId: number;
  purpose: "TEST" | "EMPLOYER_DISCLOSURE" | "SUBSTANCE_LEVEL_DISCLOSURE" | "IDENTITY_LINK";
  granted: boolean;
  scope?: unknown;
  evidenceRef?: string | null;
}) {
  try {
    const res = await occTestingORPCClient.recordConsent(input);
    return OccTestingSchemas.OkResponse.parse(res).ok;
  } catch (error) {
    throw toOccTestingApiError(error);
  }
}

export async function revokeConsent(consentId: number) {
  try {
    const res = await occTestingORPCClient.revokeConsent({ consentId });
    return OccTestingSchemas.OkResponse.parse(res).ok;
  } catch (error) {
    throw toOccTestingApiError(error);
  }
}

// ── Divulgación al empleador (consent-gated en el servidor) ───────────
export async function discloseToEmployer(input: {
  orderId: number;
  payloadKind: "AGGREGATE" | "FITNESS_OUTCOME" | "SUBSTANCE_DETAIL";
}) {
  try {
    const res = await occTestingORPCClient.discloseToEmployer(input);
    return OccTestingSchemas.OkResponse.parse(res).ok;
  } catch (error) {
    throw toOccTestingApiError(error);
  }
}
