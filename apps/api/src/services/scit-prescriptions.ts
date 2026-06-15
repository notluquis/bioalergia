import { db } from "@finanzas/db";
import type { createScitPrescriptionInputSchema } from "@finanzas/orpc-contracts/immunotherapy";
import type { z } from "zod";
import { DomainError } from "../lib/errors.ts";

// JSON-safe recursivo que espeja `JsonValue` de ZenStack (null válido solo dentro
// de objetos/arrays). Las columnas Json rechazan `undefined`.
type JsonInput =
  | string
  | number
  | boolean
  | { [key: string]: JsonInput | null }
  | Array<JsonInput | null>;

type CreateInput = z.infer<typeof createScitPrescriptionInputSchema>;

/**
 * Persiste una prescripción SCIT calculada (registro inmutable de trazabilidad).
 * La calculadora vive en el frontend; aquí se guarda la selección del médico y
 * los viales calculados tal como se mostraron, con quién/cuándo. Lanza NOT_FOUND
 * si el paciente no existe.
 */
export async function createScitPrescription(
  input: CreateInput,
  createdBy: number
): Promise<{ id: string }> {
  const patient = await db.patient.findUnique({
    where: { id: input.patientId },
    select: {
      person: { select: { names: true, fatherName: true, motherName: true, rut: true } },
    },
  });
  if (!patient) throw new DomainError("NOT_FOUND", "Paciente no encontrado");

  const fullName = [patient.person.names, patient.person.fatherName, patient.person.motherName]
    .filter(Boolean)
    .join(" ");

  const created = await db.scitPrescription.create({
    data: {
      patientId: input.patientId,
      patientName: fullName,
      patientRut: patient.person.rut,
      provider: input.provider,
      inputs: input.inputs as unknown as JsonInput,
      vials: input.vials as unknown as JsonInput,
      rulesApplied: input.rulesApplied,
      summary: input.summary,
      createdBy,
      // alerts es opcional: solo se setea si viene (Json rechaza undefined).
      ...(input.alerts ? { alerts: input.alerts as unknown as JsonInput } : {}),
    },
    select: { id: true },
  });

  return { id: created.id };
}

/** Lista las prescripciones SCIT de un paciente (más reciente primero). */
export async function listScitPrescriptionsByPatient(
  patientId: number
): Promise<{ items: Awaited<ReturnType<typeof db.scitPrescription.findMany>> }> {
  const items = await db.scitPrescription.findMany({
    where: { patientId },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return { items };
}
