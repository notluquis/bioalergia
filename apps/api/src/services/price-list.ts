import { db } from "@finanzas/db";
import type { upsertPriceListItemInputSchema } from "@finanzas/orpc-contracts/price-list";
import type { z } from "zod";
import { DomainError } from "../lib/errors.ts";

type UpsertInput = z.infer<typeof upsertPriceListItemInputSchema>;

/**
 * Lista de precios pública de prestaciones/insumos. Esta capa es la admin
 * (CRUD): el catálogo se muestra ordenado por categoría → sortOrder → nombre.
 * `code` es opcional pero único: el upsert valida colisión antes de escribir.
 */
export async function listPriceListItems(): Promise<{
  items: Awaited<ReturnType<typeof db.priceListItem.findMany>>;
}> {
  const items = await db.priceListItem.findMany({
    orderBy: [{ category: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
  });
  return { items };
}

export async function upsertPriceListItem(input: UpsertInput) {
  const code = input.code?.trim() || null;

  // `code` es único: si viene, ninguna OTRA fila puede tenerlo.
  if (code) {
    const clash = await db.priceListItem.findUnique({
      where: { code },
      select: { id: true },
    });
    if (clash && clash.id !== input.id) {
      throw new DomainError("CONFLICT", `Ya existe un ítem con el código "${code}"`);
    }
  }

  const data = {
    code,
    name: input.name,
    category: input.category,
    unit: input.unit,
    priceClp: input.priceClp,
    isActive: input.isActive,
    sortOrder: input.sortOrder,
    notes: input.notes?.trim() || null,
  };

  if (input.id) {
    const found = await db.priceListItem.findUnique({
      where: { id: input.id },
      select: { id: true },
    });
    if (!found) throw new DomainError("NOT_FOUND", "Ítem de la lista de precios no encontrado");
    return db.priceListItem.update({ where: { id: input.id }, data });
  }

  return db.priceListItem.create({ data });
}

export async function deletePriceListItem(id: string): Promise<{ status: "ok" }> {
  const found = await db.priceListItem.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!found) throw new DomainError("NOT_FOUND", "Ítem de la lista de precios no encontrado");
  await db.priceListItem.delete({ where: { id } });
  return { status: "ok" };
}
