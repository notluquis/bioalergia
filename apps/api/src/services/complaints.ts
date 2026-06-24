import { db } from "@finanzas/db";
import type {
  createBookEntryInputSchema,
  createComplaintInputSchema,
  listBookEntriesInputSchema,
  listComplaintsInputSchema,
  resolveComplaintInputSchema,
} from "@finanzas/orpc-contracts/complaints";
import type { z } from "zod";
import { DomainError } from "../lib/errors.ts";

type ListComplaintsInput = z.infer<typeof listComplaintsInputSchema>;
type CreateComplaintInput = z.infer<typeof createComplaintInputSchema>;
type ResolveComplaintInput = z.infer<typeof resolveComplaintInputSchema>;
type ListBookEntriesInput = z.infer<typeof listBookEntriesInputSchema>;
type CreateBookEntryInput = z.infer<typeof createBookEntryInputSchema>;

/**
 * Reclamos / sugerencias (Decreto 35) + libros foliados electrónicos.
 * El plazo de respuesta se computa sumando días hábiles desde la recepción.
 */
const RESPONSE_BUSINESS_DAYS = 15;

/**
 * Decreto 35: 15 días hábiles. Suma `days` días hábiles (lun-vie, sin
 * considerar feriados) a partir de `from`. Implementación nativa con Date
 * (el código base es dayjs-free: ver lib/time.ts).
 */
function addBusinessDays(from: Date, days: number): Date {
  const result = new Date(from.getTime());
  let added = 0;
  while (added < days) {
    result.setDate(result.getDate() + 1);
    const weekday = result.getDay(); // 0 = domingo, 6 = sábado
    if (weekday !== 0 && weekday !== 6) {
      added += 1;
    }
  }
  return result;
}

export async function listComplaints(input: ListComplaintsInput): Promise<{
  complaints: Awaited<ReturnType<typeof db.complaint.findMany>>;
}> {
  const complaints = await db.complaint.findMany({
    where: input.status ? { status: input.status } : undefined,
    orderBy: { dueAt: "asc" },
  });
  return { complaints };
}

export async function createComplaint(input: CreateComplaintInput) {
  const receivedAt = new Date();
  // Decreto 35: 15 días hábiles desde la recepción.
  const dueAt = addBusinessDays(receivedAt, RESPONSE_BUSINESS_DAYS);
  return db.complaint.create({
    data: {
      channel: input.channel,
      complainantName: input.complainantName,
      complainantRut: input.complainantRut ?? null,
      contact: input.contact ?? null,
      patientId: input.patientId ?? null,
      category: input.category ?? null,
      description: input.description,
      status: "RECEIVED",
      dueAt,
    },
  });
}

export async function resolveComplaint(input: ResolveComplaintInput) {
  const found = await db.complaint.findUnique({
    where: { id: input.id },
    select: { id: true },
  });
  if (!found) throw new DomainError("NOT_FOUND", "Reclamo no encontrado");

  return db.complaint.update({
    where: { id: input.id },
    data: {
      status: input.status,
      resolution: input.resolution ?? null,
      resolvedAt: input.status === "RESOLVED" ? new Date() : null,
    },
  });
}

export async function listBookEntries(input: ListBookEntriesInput): Promise<{
  entries: Awaited<ReturnType<typeof db.foliatedBookEntry.findMany>>;
}> {
  const entries = await db.foliatedBookEntry.findMany({
    where: { book: input.book },
    orderBy: { folio: "desc" },
  });
  return { entries };
}

export async function createBookEntry(input: CreateBookEntryInput, createdBy: number) {
  // Folio correlativo por libro: max(folio) + 1.
  const agg = await db.foliatedBookEntry.aggregate({
    _max: { folio: true },
    where: { book: input.book },
  });
  const nextFolio = (agg._max.folio ?? 0) + 1;

  try {
    return await db.foliatedBookEntry.create({
      data: {
        book: input.book,
        folio: nextFolio,
        entryDate: new Date(input.entryDate),
        summary: input.summary,
        refType: input.refType ?? null,
        refId: input.refId ?? null,
        createdBy,
      },
    });
  } catch (error) {
    // Violación de unicidad [book, folio] (escritura concurrente).
    if (isUniqueViolation(error)) {
      throw new DomainError("CONFLICT", "Folio en uso para este libro; reintenta la creación");
    }
    throw error;
  }
}

function isUniqueViolation(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const code = "code" in error ? (error as { code: unknown }).code : undefined;
  return code === "P2002" || code === "23505";
}
