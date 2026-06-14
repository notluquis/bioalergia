import { db } from "@finanzas/db";
import type {
  createPatientCampaignInputSchema,
  deleteRecipientInputSchema,
  listCampaignRecipientsInputSchema,
  listPatientCampaignsInputSchema,
  listRecipientsByPatientInputSchema,
  patientCampaignIdInputSchema,
  patientCampaignRecipientResponseSchema,
  patientCampaignRecipientsResponseSchema,
  patientCampaignResponseSchema,
  patientCampaignsListResponseSchema,
  patientRecipientsByPatientResponseSchema,
  updatePatientCampaignInputSchema,
  updateRecipientStatusInputSchema,
  upsertCampaignRecipientInputSchema,
} from "@finanzas/orpc-contracts/patient-campaigns";
import type { z } from "zod";
import { DomainError } from "../lib/errors.ts";

// Lógica de negocio de campañas de marketing a pacientes, fuera de los handlers
// oRPC (golden 2026: handlers finos). Los servicios hacen las queries y lanzan
// DomainError (mapeado a HTTP por orpc/error.ts::toORPCError); los handlers
// quedan: authz → service → return. Las respuestas son filas ZenStack directas
// (los schemas del contrato usan z.coerce.date(), SuperJSON serializa Date).

type RecipientStatus =
  | "PENDING"
  | "SENT"
  | "INFO_REQUESTED"
  | "IN_NEGOTIATION"
  | "ACCEPTED"
  | "DISMISSED"
  | "NO_RESPONSE";

const STATUS_KEYS: RecipientStatus[] = [
  "PENDING",
  "SENT",
  "INFO_REQUESTED",
  "IN_NEGOTIATION",
  "ACCEPTED",
  "DISMISSED",
  "NO_RESPONSE",
];

function emptyCounts(): Record<RecipientStatus, number> {
  return STATUS_KEYS.reduce(
    (acc, key) => {
      acc[key] = 0;
      return acc;
    },
    {} as Record<RecipientStatus, number>
  );
}

// Local normalizer mirrors the canonical lib/rut helper so that
// patient_campaigns.patientRut and people.rut share the same key space.
function normalizeRut(rut: string): string {
  const cleaned = rut.toUpperCase().replace(/[^0-9K]/g, "");
  if (!cleaned) return rut.trim().toUpperCase();
  const body = cleaned.slice(0, -1);
  const dv = cleaned.slice(-1);
  if (!body || !/^[0-9]+$/.test(body)) return rut.trim().toUpperCase();
  return `${Number.parseInt(body, 10)}-${dv}`;
}

async function buildCampaignWithCounts(campaignId: number) {
  const campaign = await db.patientCampaign.findUnique({ where: { id: campaignId } });
  if (!campaign) {
    throw new DomainError("NOT_FOUND", "Campaña no encontrada");
  }
  const grouped = await db.patientCampaignRecipient.groupBy({
    by: ["status"],
    where: { campaignId },
    _count: { _all: true },
  });
  const statusCounts = emptyCounts();
  let totalRecipients = 0;
  for (const row of grouped) {
    const status = row.status as RecipientStatus;
    const count = row._count._all;
    statusCounts[status] = count;
    totalRecipients += count;
  }
  return { ...campaign, statusCounts, totalRecipients };
}

type ListInput = z.infer<typeof listPatientCampaignsInputSchema>;
type ListResponse = z.infer<typeof patientCampaignsListResponseSchema>;
type IdInput = z.infer<typeof patientCampaignIdInputSchema>;
type CampaignResponse = z.infer<typeof patientCampaignResponseSchema>;
type CreateInput = z.infer<typeof createPatientCampaignInputSchema>;
type UpdateInput = z.infer<typeof updatePatientCampaignInputSchema>;
type ListRecipientsInput = z.infer<typeof listCampaignRecipientsInputSchema>;
type RecipientsResponse = z.infer<typeof patientCampaignRecipientsResponseSchema>;
type UpsertRecipientInput = z.infer<typeof upsertCampaignRecipientInputSchema>;
type RecipientResponse = z.infer<typeof patientCampaignRecipientResponseSchema>;
type UpdateRecipientStatusInput = z.infer<typeof updateRecipientStatusInputSchema>;
type DeleteRecipientInput = z.infer<typeof deleteRecipientInputSchema>;
type ListByPatientInput = z.infer<typeof listRecipientsByPatientInputSchema>;
type ByPatientResponse = z.infer<typeof patientRecipientsByPatientResponseSchema>;

export async function listPatientCampaigns(input: ListInput): Promise<ListResponse> {
  const where = input.includeInactive ? {} : { isActive: true };
  const campaigns = await db.patientCampaign.findMany({
    where,
    orderBy: { createdAt: "desc" },
  });
  if (campaigns.length === 0) {
    return { campaigns: [] };
  }
  const grouped = await db.patientCampaignRecipient.groupBy({
    by: ["campaignId", "status"],
    where: { campaignId: { in: campaigns.map((c) => c.id) } },
    _count: { _all: true },
  });
  const countsByCampaign = new Map<
    number,
    { statusCounts: Record<RecipientStatus, number>; totalRecipients: number }
  >();
  for (const row of grouped) {
    const entry = countsByCampaign.get(row.campaignId) ?? {
      statusCounts: emptyCounts(),
      totalRecipients: 0,
    };
    const status = row.status as RecipientStatus;
    const count = row._count._all;
    entry.statusCounts[status] = count;
    entry.totalRecipients += count;
    countsByCampaign.set(row.campaignId, entry);
  }
  return {
    campaigns: campaigns.map((c) => {
      const counts = countsByCampaign.get(c.id) ?? {
        statusCounts: emptyCounts(),
        totalRecipients: 0,
      };
      return { ...c, ...counts };
    }),
  };
}

export async function getPatientCampaign(input: IdInput): Promise<CampaignResponse> {
  const campaign = await buildCampaignWithCounts(input.id);
  return { campaign };
}

export async function createPatientCampaign(
  input: CreateInput,
  createdByUserId: number
): Promise<CampaignResponse> {
  const created = await db.patientCampaign.create({
    data: {
      name: input.name.trim(),
      description: input.description?.trim() || null,
      messageTemplate: input.messageTemplate?.trim() || null,
      imageUrl: input.imageUrl ? input.imageUrl.trim() || null : null,
      isActive: input.isActive ?? true,
      createdBy: createdByUserId,
    },
  });
  const campaign = await buildCampaignWithCounts(created.id);
  return { campaign };
}

export async function updatePatientCampaign(input: UpdateInput): Promise<CampaignResponse> {
  await db.patientCampaign.update({
    where: { id: input.id },
    data: {
      ...(input.name !== undefined ? { name: input.name.trim() } : {}),
      ...(input.description !== undefined
        ? { description: input.description?.trim() || null }
        : {}),
      ...(input.messageTemplate !== undefined
        ? { messageTemplate: input.messageTemplate?.trim() || null }
        : {}),
      ...(input.imageUrl !== undefined
        ? { imageUrl: input.imageUrl ? input.imageUrl.trim() || null : null }
        : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
    },
  });
  const campaign = await buildCampaignWithCounts(input.id);
  return { campaign };
}

export async function deletePatientCampaign(input: IdInput): Promise<void> {
  await db.patientCampaign.delete({ where: { id: input.id } });
}

export async function listCampaignRecipients(
  input: ListRecipientsInput
): Promise<RecipientsResponse> {
  const query = input.query?.trim();
  const recipients = await db.patientCampaignRecipient.findMany({
    where: {
      campaignId: input.campaignId,
      ...(input.status ? { status: input.status } : {}),
      ...(query
        ? {
            OR: [
              { patientRut: { contains: query, mode: "insensitive" as const } },
              { patientName: { contains: query, mode: "insensitive" as const } },
              { patientPhone: { contains: query, mode: "insensitive" as const } },
            ],
          }
        : {}),
    },
    orderBy: { updatedAt: "desc" },
  });
  return { recipients };
}

export async function upsertCampaignRecipient(
  input: UpsertRecipientInput,
  updatedByUserId: number
): Promise<RecipientResponse> {
  const campaign = await db.patientCampaign.findUnique({
    where: { id: input.campaignId },
    select: { id: true },
  });
  if (!campaign) {
    throw new DomainError("NOT_FOUND", "Campaña no encontrada");
  }

  const patientRut = normalizeRut(input.patientRut);
  let patientName = input.patientName?.trim() || null;
  let patientPhone = input.patientPhone?.trim() || null;

  if (!patientName || !patientPhone) {
    const person = await db.person.findUnique({ where: { rut: patientRut } });
    if (person) {
      if (!patientName) {
        patientName =
          [person.names, person.fatherName, person.motherName]
            .filter(Boolean)
            .join(" ")
            .trim() || null;
      }
      if (!patientPhone) {
        patientPhone = person.phone ?? null;
      }
    }
  }

  const nextStatus = input.status ?? "PENDING";
  const recipient = await db.patientCampaignRecipient.upsert({
    where: {
      campaignId_patientRut: {
        campaignId: input.campaignId,
        patientRut,
      },
    },
    create: {
      campaignId: input.campaignId,
      patientRut,
      patientName,
      patientPhone,
      status: nextStatus,
      notes: input.notes?.trim() || null,
      sentAt: nextStatus === "PENDING" ? null : new Date(),
      updatedBy: updatedByUserId,
    },
    update: {
      ...(input.patientName !== undefined ? { patientName } : {}),
      ...(input.patientPhone !== undefined ? { patientPhone } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.notes !== undefined ? { notes: input.notes?.trim() || null } : {}),
      ...(input.status && input.status !== "PENDING" ? { sentAt: new Date() } : {}),
      updatedBy: updatedByUserId,
    },
  });
  return { recipient };
}

export async function updateRecipientStatus(
  input: UpdateRecipientStatusInput,
  updatedByUserId: number
): Promise<RecipientResponse> {
  const existing = await db.patientCampaignRecipient.findUnique({
    where: { id: input.id },
  });
  if (!existing) {
    throw new DomainError("NOT_FOUND", "Destinatario no encontrado");
  }
  const now = new Date();
  const recipient = await db.patientCampaignRecipient.update({
    where: { id: input.id },
    data: {
      status: input.status,
      ...(input.notes !== undefined ? { notes: input.notes?.trim() || null } : {}),
      ...(existing.sentAt == null && input.status !== "PENDING" ? { sentAt: now } : {}),
      ...(input.status !== "PENDING" && input.status !== "SENT" && existing.respondedAt == null
        ? { respondedAt: now }
        : {}),
      updatedBy: updatedByUserId,
    },
  });
  return { recipient };
}

export async function deleteRecipient(input: DeleteRecipientInput): Promise<void> {
  await db.patientCampaignRecipient.delete({ where: { id: input.id } });
}

export async function listRecipientsByPatient(
  input: ListByPatientInput
): Promise<ByPatientResponse> {
  const recipients = await db.patientCampaignRecipient.findMany({
    where: { patientRut: normalizeRut(input.patientRut) },
    include: { campaign: true },
    orderBy: { updatedAt: "desc" },
  });
  return { recipients };
}
