import type {
  CreateClinicalAllergenInput,
  UpdateClinicalAllergenInput,
} from "@finanzas/orpc-contracts/clinical-allergens";
import { clinicalAllergensORPCClient, toAllergensApiError } from "./orpc";

export type ListAllergensOptions = {
  q?: string;
  category?: string;
  includeInactive?: boolean;
};

// ── Query keys ────────────────────────────────────────────────────────
export const allergensKeys = {
  all: ["clinical-allergens"] as const,
  list: (opts?: ListAllergensOptions) => [...allergensKeys.all, "list", opts ?? {}] as const,
  detail: (id: string) => [...allergensKeys.all, "detail", id] as const,
};

// ── Wrappers ──────────────────────────────────────────────────────────
export async function listAllergens(opts?: ListAllergensOptions) {
  try {
    const res = await clinicalAllergensORPCClient.listAllergens(opts ?? {});
    return res.allergens;
  } catch (error) {
    throw toAllergensApiError(error);
  }
}

export async function getAllergen(id: string) {
  try {
    const res = await clinicalAllergensORPCClient.getAllergen({ id });
    return res.allergen;
  } catch (error) {
    throw toAllergensApiError(error);
  }
}

export async function createAllergen(input: CreateClinicalAllergenInput) {
  try {
    const res = await clinicalAllergensORPCClient.createAllergen(input);
    return res.allergen;
  } catch (error) {
    throw toAllergensApiError(error);
  }
}

export async function updateAllergen(input: UpdateClinicalAllergenInput) {
  try {
    const res = await clinicalAllergensORPCClient.updateAllergen(input);
    return res.allergen;
  } catch (error) {
    throw toAllergensApiError(error);
  }
}

export async function deactivateAllergen(id: string) {
  try {
    const res = await clinicalAllergensORPCClient.deactivateAllergen({ id });
    return res.allergen;
  } catch (error) {
    throw toAllergensApiError(error);
  }
}
