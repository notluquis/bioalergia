import type {
  AttestRiohsInput,
  CreateOccupationalProgramInput,
  CreateTestBatchInput,
  SetProgramStatusInput,
  UpdateOccupationalProgramInput,
} from "@finanzas/orpc-contracts/occupational";
import { occupationalORPCClient, toOccupationalApiError } from "./orpc";
import { OccupationalSchemas } from "./schemas";

// ── Query keys ────────────────────────────────────────────────────────
export const occupationalKeys = {
  all: ["occupational"] as const,
  programs: () => [...occupationalKeys.all, "programs"] as const,
  batches: (programId: number) => [...occupationalKeys.all, "batches", programId] as const,
};

// ── Programas ─────────────────────────────────────────────────────────
export async function listPrograms() {
  try {
    const res = await occupationalORPCClient.listPrograms();
    return OccupationalSchemas.ProgramListResponse.parse(res).programs;
  } catch (error) {
    throw toOccupationalApiError(error);
  }
}

export async function createProgram(input: CreateOccupationalProgramInput) {
  try {
    const res = await occupationalORPCClient.createProgram(input);
    return OccupationalSchemas.ProgramResponse.parse(res).program;
  } catch (error) {
    throw toOccupationalApiError(error);
  }
}

export async function updateProgram(input: UpdateOccupationalProgramInput) {
  try {
    const res = await occupationalORPCClient.updateProgram(input);
    return OccupationalSchemas.ProgramResponse.parse(res).program;
  } catch (error) {
    throw toOccupationalApiError(error);
  }
}

export async function attestRiohs(input: AttestRiohsInput) {
  try {
    const res = await occupationalORPCClient.attestRiohs(input);
    return OccupationalSchemas.ProgramResponse.parse(res).program;
  } catch (error) {
    throw toOccupationalApiError(error);
  }
}

export async function setProgramStatus(input: SetProgramStatusInput) {
  try {
    const res = await occupationalORPCClient.setProgramStatus(input);
    return OccupationalSchemas.ProgramResponse.parse(res).program;
  } catch (error) {
    throw toOccupationalApiError(error);
  }
}

// ── Lotes de resultado AGREGADO ───────────────────────────────────────
export async function listTestBatches(programId: number) {
  try {
    const res = await occupationalORPCClient.listTestBatches({ programId });
    return OccupationalSchemas.TestBatchListResponse.parse(res).batches;
  } catch (error) {
    throw toOccupationalApiError(error);
  }
}

export async function createTestBatch(input: CreateTestBatchInput) {
  try {
    const res = await occupationalORPCClient.createTestBatch(input);
    return OccupationalSchemas.TestBatchResponse.parse(res).batch;
  } catch (error) {
    throw toOccupationalApiError(error);
  }
}
