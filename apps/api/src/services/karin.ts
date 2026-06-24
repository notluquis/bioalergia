import { db } from "@finanzas/db";
import type {
  CreateKarinReportInput,
  ResolveKarinReportInput,
  listKarinReportsInputSchema,
} from "@finanzas/orpc-contracts/karin";
import type { z } from "zod";
import { DomainError } from "../lib/errors.ts";
import { logError, logEvent } from "../lib/logger.ts";
import { loadSettings } from "../lib/settings.ts";
import { sendKarinReportNotification } from "./email/transactional.ts";

type ListKarinReportsInput = z.infer<typeof listKarinReportsInputSchema>;

/**
 * Canal de denuncia Ley Karin (Ley 21.643 + Decreto 21/2024).
 *
 * Plazos del procedimiento, computados en días hábiles desde la recepción:
 *  - Resguardo inmediato: medidas de protección sin demora (1 día hábil).
 *  - Remisión a la Inspección del Trabajo / inicio de investigación: 3 días hábiles.
 *  - Cierre de la investigación: 30 días hábiles.
 */
const RESGUARDO_BUSINESS_DAYS = 1;
const REMITIR_BUSINESS_DAYS = 3;
const INVESTIGATION_BUSINESS_DAYS = 30;

/**
 * Suma `days` días hábiles (lun-vie, sin feriados) a `from`. Mirror de
 * `addBusinessDays` en services/complaints.ts — el código base es dayjs-free.
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

export async function listKarinReports(input: ListKarinReportsInput): Promise<{
  reports: Awaited<ReturnType<typeof db.karinReport.findMany>>;
}> {
  const reports = await db.karinReport.findMany({
    where: input.status ? { status: input.status } : undefined,
    orderBy: { remitirDueAt: "asc" },
  });
  return { reports };
}

/**
 * Crea una denuncia Ley Karin. Honeypot: si `website` trae contenido, es un bot
 * -> se descarta en silencio. El aviso al buzón restringido es best-effort.
 */
export async function createKarinReport(
  input: CreateKarinReportInput
): Promise<{ ok: true; id: string }> {
  if (input.website && input.website.length > 0) {
    return { ok: true, id: "" };
  }

  const receivedAt = new Date();
  const report = await db.karinReport.create({
    data: {
      reportType: input.reportType,
      reporterName: input.reporterName.trim(),
      reporterRut: input.reporterRut?.trim() || null,
      reporterContact: input.reporterContact?.trim() || null,
      reportedPerson: input.reportedPerson?.trim() || null,
      description: input.description.trim(),
      occurredAt: input.occurredAt ? new Date(input.occurredAt) : null,
      status: "RECIBIDA",
      receivedAt,
      resguardoDueAt: addBusinessDays(receivedAt, RESGUARDO_BUSINESS_DAYS),
      remitirDueAt: addBusinessDays(receivedAt, REMITIR_BUSINESS_DAYS),
      investigationDueAt: addBusinessDays(receivedAt, INVESTIGATION_BUSINESS_DAYS),
    },
  });

  try {
    const settings = await loadSettings();
    await sendKarinReportNotification({
      to: settings.karinReportsEmail,
      report: {
        id: report.id,
        reportType: report.reportType,
        reporterName: report.reporterName,
        reportedPerson: report.reportedPerson,
        resguardoDueAt: report.resguardoDueAt,
        remitirDueAt: report.remitirDueAt,
        investigationDueAt: report.investigationDueAt,
      },
    });
  } catch (err) {
    logError(err, { module: "api", operation: "karin.report.notify", reportId: report.id });
  }
  logEvent("[karin] report created", { id: report.id, type: report.reportType });
  return { ok: true, id: report.id };
}

export async function resolveKarinReport(input: ResolveKarinReportInput, handledBy: number) {
  const found = await db.karinReport.findUnique({
    where: { id: input.id },
    select: { id: true },
  });
  if (!found) throw new DomainError("NOT_FOUND", "Denuncia no encontrada");

  return db.karinReport.update({
    where: { id: input.id },
    data: {
      status: input.status,
      resolution: input.resolution ?? null,
      handledBy,
    },
  });
}
