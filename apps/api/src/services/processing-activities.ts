import { db } from "@finanzas/db";
import type { upsertProcessingActivityInputSchema } from "@finanzas/orpc-contracts/processing-activities";
import type { z } from "zod";
import { DomainError } from "../lib/errors.ts";

type UpsertInput = z.infer<typeof upsertProcessingActivityInputSchema>;

/**
 * Registro de Actividades de Tratamiento (RAT) — Ley 21.719. Inventario admin
 * (CRUD) de las actividades de tratamiento de datos personales que el
 * responsable debe mantener documentadas.
 */
export async function listProcessingActivities(): Promise<{
  activities: Awaited<ReturnType<typeof db.processingActivity.findMany>>;
}> {
  const activities = await db.processingActivity.findMany({
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
  });
  return { activities };
}

export async function upsertProcessingActivity(input: UpsertInput) {
  const data = {
    name: input.name,
    purpose: input.purpose,
    legalBasis: input.legalBasis,
    dataCategories: input.dataCategories,
    dataSubjects: input.dataSubjects,
    recipients: input.recipients ?? null,
    retentionPeriod: input.retentionPeriod ?? null,
    securityMeasures: input.securityMeasures ?? null,
    internationalTransfer: input.internationalTransfer,
    isActive: input.isActive,
    notes: input.notes ?? null,
  };

  if (input.id) {
    const found = await db.processingActivity.findUnique({
      where: { id: input.id },
      select: { id: true },
    });
    if (!found) throw new DomainError("NOT_FOUND", "Actividad de tratamiento no encontrada");
    return db.processingActivity.update({ where: { id: input.id }, data });
  }

  return db.processingActivity.create({ data });
}

export async function deleteProcessingActivity(id: string): Promise<{ status: "ok" }> {
  const found = await db.processingActivity.findUnique({ where: { id }, select: { id: true } });
  if (!found) throw new DomainError("NOT_FOUND", "Actividad de tratamiento no encontrada");
  await db.processingActivity.delete({ where: { id } });
  return { status: "ok" };
}
