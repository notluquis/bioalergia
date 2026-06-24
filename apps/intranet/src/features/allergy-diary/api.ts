import type { UpsertDiaryEntryInput } from "@finanzas/orpc-contracts/allergy-diary";
import { allergyDiaryORPCClient, toAllergyDiaryApiError } from "./orpc";
import {
  deleteDiaryEntryResponseSchema,
  diaryEntryListResponseSchema,
  diaryEntryResponseSchema,
  diarySeasonSchema,
} from "./schemas";

// ── Query keys ────────────────────────────────────────────────────────
export const allergyDiaryKeys = {
  all: ["allergy-diary"] as const,
  list: (patientId: number, from?: Date, to?: Date) =>
    [
      ...allergyDiaryKeys.all,
      "list",
      patientId,
      from?.toISOString() ?? null,
      to?.toISOString() ?? null,
    ] as const,
  season: (patientId: number, seasonStart: Date, seasonEnd: Date) =>
    [
      ...allergyDiaryKeys.all,
      "season",
      patientId,
      seasonStart.toISOString(),
      seasonEnd.toISOString(),
    ] as const,
};

// ── Wrappers ──────────────────────────────────────────────────────────
export async function listEntries(input: { patientId: number; from?: Date; to?: Date }) {
  try {
    const res = await allergyDiaryORPCClient.listEntries(input);
    return diaryEntryListResponseSchema.parse(res);
  } catch (error) {
    throw toAllergyDiaryApiError(error);
  }
}

export async function upsertEntry(input: UpsertDiaryEntryInput) {
  try {
    const res = await allergyDiaryORPCClient.upsertEntry(input);
    return diaryEntryResponseSchema.parse(res).entry;
  } catch (error) {
    throw toAllergyDiaryApiError(error);
  }
}

export async function deleteEntry(id: number) {
  try {
    const res = await allergyDiaryORPCClient.deleteEntry({ id });
    return deleteDiaryEntryResponseSchema.parse(res);
  } catch (error) {
    throw toAllergyDiaryApiError(error);
  }
}

export async function fetchSeason(input: {
  patientId: number;
  seasonStart: Date;
  seasonEnd: Date;
}) {
  try {
    const res = await allergyDiaryORPCClient.season(input);
    return diarySeasonSchema.parse(res);
  } catch (error) {
    throw toAllergyDiaryApiError(error);
  }
}
