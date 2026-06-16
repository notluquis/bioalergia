import { db } from "@finanzas/db";
import type { upsertRetentionPolicyInputSchema } from "@finanzas/orpc-contracts/settings";
import type { z } from "zod";
import { DomainError } from "../lib/errors.ts";

type UpsertInput = z.infer<typeof upsertRetentionPolicyInputSchema>;

/**
 * Políticas de retención de datos por tabla (Ley 21.719): el sweep
 * (lib/retention-sweep.ts) consume las habilitadas para borrar/anonimizar filas
 * más viejas que windowDays sobre dateColumn. Esta capa es la admin (CRUD).
 */
export async function listRetentionPolicies(): Promise<{
  policies: Awaited<ReturnType<typeof db.dataRetentionPolicy.findMany>>;
}> {
  const policies = await db.dataRetentionPolicy.findMany({ orderBy: { table: "asc" } });
  return { policies };
}

export async function upsertRetentionPolicy(input: UpsertInput) {
  const data = {
    enabled: input.enabled,
    action: input.action,
    windowDays: input.windowDays,
    dateColumn: input.dateColumn,
    // Json: pasar el objeto (no JSON.stringify). Default {} si no viene.
    anonymizeMap: (input.anonymizeMap ?? {}) as never,
    notes: input.notes ?? null,
  };
  return db.dataRetentionPolicy.upsert({
    where: { table: input.table },
    update: data,
    create: { table: input.table, ...data },
  });
}

export async function deleteRetentionPolicy(table: string): Promise<{ status: "ok" }> {
  const found = await db.dataRetentionPolicy.findUnique({
    where: { table },
    select: { table: true },
  });
  if (!found) throw new DomainError("NOT_FOUND", "Política de retención no encontrada");
  await db.dataRetentionPolicy.delete({ where: { table } });
  return { status: "ok" };
}
