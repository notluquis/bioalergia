import { db } from "@finanzas/db";
import { OpenAPIHandler } from "@orpc/openapi/fetch";
import { OpenAPIReferencePlugin } from "@orpc/openapi/plugins";
import {
  createPatientCampaignInputSchema,
  deleteRecipientInputSchema,
  listCampaignRecipientsInputSchema,
  listPatientCampaignsInputSchema,
  listRecipientsByPatientInputSchema,
  patientCampaignIdInputSchema,
  patientCampaignRecipientResponseSchema,
  patientCampaignRecipientsResponseSchema,
  patientCampaignResponseSchema,
  patientCampaignStatusResponseSchema,
  patientCampaignsListResponseSchema,
  patientRecipientsByPatientResponseSchema,
  updatePatientCampaignInputSchema,
  updateRecipientStatusInputSchema,
  upsertCampaignRecipientInputSchema,
} from "@finanzas/orpc-contracts/patient-campaigns";
import { ORPCError, onError, os } from "@orpc/server";
import { ZodToJsonSchemaConverter } from "@orpc/zod/zod4";
import type { Context as HonoContext } from "hono";
import { getSessionUser, hasPermission } from "../auth.ts";
import { logError } from "../lib/logger.ts";
import { configureSuperjson } from "../lib/superjson-config.ts";
import { SuperJSONRPCHandler } from "./superjson.ts";

configureSuperjson();

type PatientCampaignsORPCContext = {
  hono: HonoContext;
};

const base = os.$context<PatientCampaignsORPCContext>();

const authed = base.use(async ({ context, next }) => {
  const user = await getSessionUser(context.hono);
  if (!user) {
    throw new ORPCError("UNAUTHORIZED", { message: "No autorizado" });
  }
  return next({ context: { ...context, user } });
});

const readCampaigns = authed.use(async ({ context, next }) => {
  const ok = await hasPermission(context.user, "read", "PatientCampaign");
  if (!ok) throw new ORPCError("FORBIDDEN", { message: "Forbidden" });
  return next();
});

const createCampaigns = authed.use(async ({ context, next }) => {
  const ok = await hasPermission(context.user, "create", "PatientCampaign");
  if (!ok) throw new ORPCError("FORBIDDEN", { message: "Forbidden" });
  return next();
});

const updateCampaigns = authed.use(async ({ context, next }) => {
  const ok = await hasPermission(context.user, "update", "PatientCampaign");
  if (!ok) throw new ORPCError("FORBIDDEN", { message: "Forbidden" });
  return next();
});

const deleteCampaigns = authed.use(async ({ context, next }) => {
  const ok = await hasPermission(context.user, "delete", "PatientCampaign");
  if (!ok) throw new ORPCError("FORBIDDEN", { message: "Forbidden" });
  return next();
});

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

function emptyCounts() {
  return STATUS_KEYS.reduce(
    (acc, key) => {
      acc[key] = 0;
      return acc;
    },
    {} as Record<RecipientStatus, number>,
  );
}

async function buildCampaignWithCounts(campaignId: number) {
  const campaign = await db.patientCampaign.findUnique({ where: { id: campaignId } });
  if (!campaign) {
    throw new ORPCError("NOT_FOUND", { message: "Campaña no encontrada" });
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

// Local normalizer mirrors the canonical lib/rut helper so that
// patient_campaigns.patientRut and people.rut share the same key space.
function normalizeRut(rut: string) {
  // Inline implementation duplicates lib/rut canonicalRutFilter logic to
  // avoid pulling additional imports in this module's hot paths.
  const cleaned = rut.toUpperCase().replace(/[^0-9K]/g, "");
  if (!cleaned) return rut.trim().toUpperCase();
  const body = cleaned.slice(0, -1);
  const dv = cleaned.slice(-1);
  if (!body || !/^[0-9]+$/.test(body)) return rut.trim().toUpperCase();
  return `${Number.parseInt(body, 10)}-${dv}`;
}

const patientCampaignsRouterBase = {
  listCampaigns: readCampaigns
    .route({ method: "GET", path: "/", tags: ["Patient Campaigns"] })
    .input(listPatientCampaignsInputSchema)
    .output(patientCampaignsListResponseSchema)
    .handler(async ({ input }) => {
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
    }),

  getCampaign: readCampaigns
    .route({ method: "GET", path: "/{id}", tags: ["Patient Campaigns"] })
    .input(patientCampaignIdInputSchema)
    .output(patientCampaignResponseSchema)
    .handler(async ({ input }) => {
      const campaign = await buildCampaignWithCounts(input.id);
      return { campaign };
    }),

  createCampaign: createCampaigns
    .route({ method: "POST", path: "/", tags: ["Patient Campaigns"] })
    .input(createPatientCampaignInputSchema)
    .output(patientCampaignResponseSchema)
    .handler(async ({ context, input }) => {
      const created = await db.patientCampaign.create({
        data: {
          name: input.name.trim(),
          description: input.description?.trim() || null,
          messageTemplate: input.messageTemplate?.trim() || null,
          imageUrl: input.imageUrl ? input.imageUrl.trim() || null : null,
          isActive: input.isActive ?? true,
          createdBy: context.user.id,
        },
      });
      const campaign = await buildCampaignWithCounts(created.id);
      return { campaign };
    }),

  updateCampaign: updateCampaigns
    .route({ method: "PUT", path: "/{id}", tags: ["Patient Campaigns"] })
    .input(updatePatientCampaignInputSchema)
    .output(patientCampaignResponseSchema)
    .handler(async ({ input }) => {
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
    }),

  deleteCampaign: deleteCampaigns
    .route({ method: "DELETE", path: "/{id}", tags: ["Patient Campaigns"] })
    .input(patientCampaignIdInputSchema)
    .output(patientCampaignStatusResponseSchema)
    .handler(async ({ input }) => {
      await db.patientCampaign.delete({ where: { id: input.id } });
      return { status: "ok" as const };
    }),

  listRecipients: readCampaigns
    .route({ method: "GET", path: "/{campaignId}/recipients", tags: ["Patient Campaigns"] })
    .input(listCampaignRecipientsInputSchema)
    .output(patientCampaignRecipientsResponseSchema)
    .handler(async ({ input }) => {
      const query = input.query?.trim();
      const recipients = await db.patientCampaignRecipient.findMany({
        where: {
          campaignId: input.campaignId,
          ...(input.status ? { status: input.status } : {}),
          ...(query
            ? {
                OR: [
                  { patientRut: { contains: query, mode: "insensitive" } },
                  { patientName: { contains: query, mode: "insensitive" } },
                  { patientPhone: { contains: query, mode: "insensitive" } },
                ],
              }
            : {}),
        },
        orderBy: { updatedAt: "desc" },
      });
      return { recipients };
    }),

  upsertRecipient: updateCampaigns
    .route({ method: "POST", path: "/recipients", tags: ["Patient Campaigns"] })
    .input(upsertCampaignRecipientInputSchema)
    .output(patientCampaignRecipientResponseSchema)
    .handler(async ({ context, input }) => {
      const campaign = await db.patientCampaign.findUnique({
        where: { id: input.campaignId },
        select: { id: true },
      });
      if (!campaign) {
        throw new ORPCError("NOT_FOUND", { message: "Campaña no encontrada" });
      }

      const patientRut = normalizeRut(input.patientRut);
      let patientName = input.patientName?.trim() || null;
      let patientPhone = input.patientPhone?.trim() || null;

      if (!patientName || !patientPhone) {
        const person = await db.person.findUnique({ where: { rut: patientRut } });
        if (person) {
          if (!patientName) {
            patientName = [person.names, person.fatherName, person.motherName]
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
          updatedBy: context.user.id,
        },
        update: {
          ...(input.patientName !== undefined ? { patientName } : {}),
          ...(input.patientPhone !== undefined ? { patientPhone } : {}),
          ...(input.status !== undefined ? { status: input.status } : {}),
          ...(input.notes !== undefined ? { notes: input.notes?.trim() || null } : {}),
          ...(input.status && input.status !== "PENDING" ? { sentAt: new Date() } : {}),
          updatedBy: context.user.id,
        },
      });
      return { recipient };
    }),

  updateRecipientStatus: updateCampaigns
    .route({ method: "PUT", path: "/recipients/{id}", tags: ["Patient Campaigns"] })
    .input(updateRecipientStatusInputSchema)
    .output(patientCampaignRecipientResponseSchema)
    .handler(async ({ context, input }) => {
      const existing = await db.patientCampaignRecipient.findUnique({
        where: { id: input.id },
      });
      if (!existing) {
        throw new ORPCError("NOT_FOUND", { message: "Destinatario no encontrado" });
      }
      const now = new Date();
      const recipient = await db.patientCampaignRecipient.update({
        where: { id: input.id },
        data: {
          status: input.status,
          ...(input.notes !== undefined ? { notes: input.notes?.trim() || null } : {}),
          ...(existing.sentAt == null && input.status !== "PENDING" ? { sentAt: now } : {}),
          ...(input.status !== "PENDING" &&
          input.status !== "SENT" &&
          existing.respondedAt == null
            ? { respondedAt: now }
            : {}),
          updatedBy: context.user.id,
        },
      });
      return { recipient };
    }),

  deleteRecipient: updateCampaigns
    .route({ method: "DELETE", path: "/recipients/{id}", tags: ["Patient Campaigns"] })
    .input(deleteRecipientInputSchema)
    .output(patientCampaignStatusResponseSchema)
    .handler(async ({ input }) => {
      await db.patientCampaignRecipient.delete({ where: { id: input.id } });
      return { status: "ok" as const };
    }),

  listByPatient: readCampaigns
    .route({ method: "GET", path: "/by-patient", tags: ["Patient Campaigns"] })
    .input(listRecipientsByPatientInputSchema)
    .output(patientRecipientsByPatientResponseSchema)
    .handler(async ({ input }) => {
      const recipients = await db.patientCampaignRecipient.findMany({
        where: { patientRut: normalizeRut(input.patientRut) },
        include: { campaign: true },
        orderBy: { updatedAt: "desc" },
      });
      return { recipients };
    }),
};

export const patientCampaignsORPCRouter = base
  .prefix("/api/orpc/patient-campaigns")
  .router(patientCampaignsRouterBase);

export const patientCampaignsORPCHandler = new SuperJSONRPCHandler(patientCampaignsORPCRouter, {
  interceptors: [
    onError((error) => {
      logError(error, {
        module: "api",
        operation: "orpc.patient-campaigns",
      });
    }),
  ],
});

export const patientCampaignsOpenAPIHandler = new OpenAPIHandler(patientCampaignsORPCRouter, {
  plugins: [
    new OpenAPIReferencePlugin({
      schemaConverters: [new ZodToJsonSchemaConverter()],
      specGenerateOptions: {
        info: {
          title: "Bioalergia Patient Campaigns oRPC",
          description: "Contratos oRPC/OpenAPI para campañas de marketing a pacientes.",
          version: "1.0.0",
        },
      },
    }),
  ],
  interceptors: [
    onError((error) => {
      logError(error, {
        module: "api",
        operation: "openapi.patient-campaigns",
      });
    }),
  ],
});

export type PatientCampaignsORPCRouter = typeof patientCampaignsORPCRouter;
