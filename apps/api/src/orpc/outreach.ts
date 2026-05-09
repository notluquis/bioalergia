import { db } from "@finanzas/db";
import type {
  OutreachCampaign,
  OutreachCampaignFilters,
} from "@finanzas/orpc-contracts/outreach";
import {
  apolloEnrichInputSchema,
  apolloEnrichResponseSchema,
  bulkCrawlInputSchema,
  bulkCrawlStartResponseSchema,
  bulkCrawlStatusInputSchema,
  bulkCrawlStatusResponseSchema,
  bulkUpdateEstablishmentsInputSchema,
  crawlProspectInputSchema,
  crawlProspectResponseSchema,
  discoverGooglePlacesInputSchema,
  discoverGooglePlacesResponseSchema,
  hunterDomainInputSchema,
  hunterDomainResponseSchema,
  hunterVerifyEmailInputSchema,
  hunterVerifyResponseSchema,
  recomputeScoreInputSchema,
  scoreResponseSchema,
  zonasResponseSchema,
  campaignDetailResponseSchema,
  campaignIdInputSchema,
  campaignPreviewResponseSchema,
  campaignResponseSchema,
  contactIdInputSchema,
  contactResponseSchema,
  createCampaignInputSchema,
  createInteractionInputSchema,
  dashboardResponseSchema,
  establishmentDetailResponseSchema,
  establishmentRbdInputSchema,
  establishmentResponseSchema,
  filtersResponseSchema,
  importMineducInputSchema,
  importMineducResponseSchema,
  interactionIdInputSchema,
  interactionResponseSchema,
  launchCampaignInputSchema,
  listCampaignsResponseSchema,
  listEstablishmentsInputSchema,
  listEstablishmentsResponseSchema,
  nextDeliveryBatchInputSchema,
  nextDeliveryBatchResponseSchema,
  okResponseSchema,
  previewCampaignInputSchema,
  recordDeliveryResultInputSchema,
  updateCampaignInputSchema,
  updateEstablishmentInputSchema,
  upsertContactInputSchema,
} from "@finanzas/orpc-contracts/outreach";
import { OpenAPIHandler } from "@orpc/openapi/fetch";
import { OpenAPIReferencePlugin } from "@orpc/openapi/plugins";
import { ORPCError, onError, os } from "@orpc/server";
import { ZodToJsonSchemaConverter } from "@orpc/zod/zod4";
import type { Context as HonoContext } from "hono";
import { z } from "zod";
import { getSessionUser, hasPermission } from "../auth.ts";
import { logError } from "../lib/logger.ts";
import { configureSuperjson } from "../lib/superjson-config.ts";
import {
  completeJob,
  failJob,
  getJobStatus,
  startJob,
  updateJobProgress,
} from "../lib/job-queue/jobQueue.ts";
import { enrichProspectWithApollo } from "../modules/outreach/apollo.ts";
import { buildCampaignDeliveries, selectCandidates } from "../modules/outreach/campaign-builder.ts";
import { discoverGooglePlaces } from "../modules/outreach/google-places.ts";
import { hunterEnrichProspect, verifyEmail } from "../modules/outreach/hunter.ts";
import { importMineducDataset } from "../modules/outreach/mineduc-importer.ts";
import { recomputeProspectScore } from "../modules/outreach/scoring.ts";
import { renderTemplate } from "../modules/outreach/template.ts";
import { crawlProspect as runCrawler } from "../modules/outreach/web-crawler.ts";
import { CATEGORIAS_GOOGLE_PLACES, ZONAS } from "../modules/outreach/zonas.ts";
import { SuperJSONRPCHandler } from "./superjson.ts";

configureSuperjson();

type OutreachORPCContext = { hono: HonoContext };

const base = os.$context<OutreachORPCContext>();

const authed = base.use(async ({ context, next }) => {
  const user = await getSessionUser(context.hono);
  if (!user) throw new ORPCError("UNAUTHORIZED", { message: "No autorizado" });
  return next({ context: { ...context, user } });
});

function gate(action: "read" | "create" | "update" | "delete", subject: string) {
  return authed.use(async ({ context, next }) => {
    const ok = await hasPermission(context.user, action, subject);
    if (!ok) throw new ORPCError("FORBIDDEN", { message: "Forbidden" });
    return next();
  });
}

const readOutreach = gate("read", "OutreachEstablishment");
const createOutreach = gate("create", "OutreachEstablishment");
const updateOutreach = gate("update", "OutreachEstablishment");
const deleteOutreach = gate("delete", "OutreachEstablishment");

async function runBulkCrawl(jobId: string, rbds: string[]) {
  let successful = 0;
  let failed = 0;
  let emailsFound = 0;
  let phonesFound = 0;
  for (let i = 0; i < rbds.length; i++) {
    const rbd = rbds[i]!;
    try {
      const r = await runCrawler(rbd);
      if (r.success) successful += 1;
      else failed += 1;
      emailsFound += r.emails.length;
      phonesFound += r.phones.length;
      await recomputeProspectScore(rbd).catch(() => undefined);
    } catch {
      failed += 1;
    }
    updateJobProgress(jobId, i + 1, `Procesando ${i + 1}/${rbds.length}`);
  }
  completeJob(jobId, { successful, failed, emailsFound, phonesFound });
}

function normalizeCampaign(c: Record<string, unknown>): OutreachCampaign {
  return {
    ...(c as unknown as OutreachCampaign),
    filtros: ((c.filtros as OutreachCampaignFilters | null) ?? {}) as OutreachCampaignFilters,
  };
}

function buildEstablishmentWhere(input: z.infer<typeof listEstablishmentsInputSchema>) {
  const where: Record<string, unknown> = {};
  if (input.soloActivos !== false) where.activo = true;
  if (input.estados?.length) where.estado = { in: input.estados };
  if (input.dependencias?.length) where.dependencia = { in: input.dependencias };
  if (input.comunas?.length) where.comuna = { in: input.comunas };
  if (input.ciudades?.length) where.ciudad = { in: input.ciudades };
  if (input.tipos?.length) where.tipo = { in: input.tipos };
  if (input.fuentes?.length) where.fuente = { in: input.fuentes };
  if (input.prioridades?.length) where.prioridad = { in: input.prioridades };
  if (input.search) {
    const q = input.search.trim();
    where.OR = [
      { nombre: { contains: q, mode: "insensitive" } },
      { directorMineduc: { contains: q, mode: "insensitive" } },
      { emailMineduc: { contains: q, mode: "insensitive" } },
      { rbd: { contains: q } },
    ];
  }
  if (input.soloConEmail) {
    where.OR = [
      ...(Array.isArray(where.OR) ? (where.OR as unknown[]) : []),
      { emailMineduc: { not: null } },
    ];
  }
  return where;
}

const outreachRouterBase = {
  listEstablishments: readOutreach
    .route({ method: "POST", path: "/establishments/list", tags: ["Outreach"] })
    .input(listEstablishmentsInputSchema)
    .output(listEstablishmentsResponseSchema)
    .handler(async ({ input }) => {
      const where = buildEstablishmentWhere(input);
      const total = await db.outreachEstablishment.count({ where });
      const items = await db.outreachEstablishment.findMany({
        where,
        orderBy: { [input.sortBy]: input.sortDir },
        skip: (input.page - 1) * input.pageSize,
        take: input.pageSize,
      });
      const rbds = items.map((e) => e.rbd);
      const contactCounts = rbds.length
        ? await db.outreachContact.groupBy({
            by: ["establecimientoRbd"],
            where: { establecimientoRbd: { in: rbds } },
            _count: { _all: true },
          })
        : [];
      const interactionAgg = rbds.length
        ? await db.outreachInteraction.groupBy({
            by: ["establecimientoRbd"],
            where: { establecimientoRbd: { in: rbds } },
            _count: { _all: true },
            _max: { fecha: true },
          })
        : [];
      const cMap = new Map(contactCounts.map((r) => [r.establecimientoRbd, r._count._all]));
      const iMap = new Map(
        interactionAgg.map((r) => [
          r.establecimientoRbd,
          { count: r._count._all, last: r._max.fecha },
        ]),
      );
      return {
        items: items.map((e) => ({
          ...e,
          contactosCount: cMap.get(e.rbd) ?? 0,
          interaccionesCount: iMap.get(e.rbd)?.count ?? 0,
          ultimaInteraccionAt: iMap.get(e.rbd)?.last ?? null,
        })),
        total,
        page: input.page,
        pageSize: input.pageSize,
      };
    }),

  getEstablishment: readOutreach
    .route({ method: "POST", path: "/establishments/get", tags: ["Outreach"] })
    .input(establishmentRbdInputSchema)
    .output(establishmentDetailResponseSchema)
    .handler(async ({ input }) => {
      const establishment = await db.outreachEstablishment.findUnique({
        where: { rbd: input.rbd },
      });
      if (!establishment) {
        throw new ORPCError("NOT_FOUND", { message: "Establecimiento no encontrado" });
      }
      const [contactos, interacciones, envios] = await Promise.all([
        db.outreachContact.findMany({
          where: { establecimientoRbd: input.rbd },
          orderBy: [{ esPrincipal: "desc" }, { createdAt: "asc" }],
        }),
        db.outreachInteraction.findMany({
          where: { establecimientoRbd: input.rbd },
          orderBy: { fecha: "desc" },
          take: 100,
        }),
        db.outreachEmailDelivery.findMany({
          where: { establecimientoRbd: input.rbd },
          orderBy: { createdAt: "desc" },
          take: 50,
        }),
      ]);
      return { establishment, contactos, interacciones, envios };
    }),

  updateEstablishment: updateOutreach
    .route({ method: "POST", path: "/establishments/update", tags: ["Outreach"] })
    .input(updateEstablishmentInputSchema)
    .output(establishmentResponseSchema)
    .handler(async ({ input }) => {
      const { rbd, ...rest } = input;
      const data: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(rest)) {
        if (v !== undefined) data[k] = v;
      }
      const establishment = await db.outreachEstablishment.update({
        where: { rbd },
        data,
      });
      return { establishment };
    }),

  bulkUpdateEstablishments: updateOutreach
    .route({ method: "POST", path: "/establishments/bulk-update", tags: ["Outreach"] })
    .input(bulkUpdateEstablishmentsInputSchema)
    .output(z.object({ updated: z.number().int() }))
    .handler(async ({ input }) => {
      const data: Record<string, unknown> = {};
      if (input.estado) data.estado = input.estado;
      if (input.prioridad) data.prioridad = input.prioridad;
      let updated = 0;
      if (Object.keys(data).length > 0) {
        const r = await db.outreachEstablishment.updateMany({
          where: { rbd: { in: input.rbds } },
          data,
        });
        updated = r.count ?? input.rbds.length;
      }
      if (input.agregarEtiqueta || input.removerEtiqueta) {
        const items = await db.outreachEstablishment.findMany({
          where: { rbd: { in: input.rbds } },
          select: { rbd: true, etiquetas: true },
        });
        for (const it of items) {
          const set = new Set(it.etiquetas);
          if (input.agregarEtiqueta) set.add(input.agregarEtiqueta);
          if (input.removerEtiqueta) set.delete(input.removerEtiqueta);
          await db.outreachEstablishment.update({
            where: { rbd: it.rbd },
            data: { etiquetas: Array.from(set) },
          });
        }
        if (!Object.keys(data).length) updated = items.length;
      }
      return { updated };
    }),

  filtersMeta: readOutreach
    .route({ method: "GET", path: "/filters", tags: ["Outreach"] })
    .input(z.object({}).optional())
    .output(filtersResponseSchema)
    .handler(async () => {
      const comunas = await db.outreachEstablishment.findMany({
        distinct: ["comuna"],
        select: { comuna: true },
        orderBy: { comuna: "asc" },
      });
      const all = await db.outreachEstablishment.findMany({ select: { etiquetas: true } });
      const tagSet = new Set<string>();
      for (const e of all) for (const t of e.etiquetas) tagSet.add(t);
      return {
        comunas: comunas.map((c) => c.comuna),
        etiquetas: Array.from(tagSet).sort(),
      };
    }),

  upsertContact: updateOutreach
    .route({ method: "POST", path: "/contacts/upsert", tags: ["Outreach"] })
    .input(upsertContactInputSchema)
    .output(contactResponseSchema)
    .handler(async ({ input }) => {
      if (input.esPrincipal) {
        await db.outreachContact.updateMany({
          where: { establecimientoRbd: input.establecimientoRbd, esPrincipal: true },
          data: { esPrincipal: false },
        });
      }
      const data = {
        establecimientoRbd: input.establecimientoRbd,
        nombre: input.nombre,
        cargo: input.cargo,
        email: input.email ?? null,
        telefono: input.telefono ?? null,
        esPrincipal: input.esPrincipal ?? false,
        notas: input.notas ?? null,
      };
      const contacto = input.id
        ? await db.outreachContact.update({ where: { id: input.id }, data })
        : await db.outreachContact.create({ data });
      return { contacto };
    }),

  deleteContact: deleteOutreach
    .route({ method: "POST", path: "/contacts/delete", tags: ["Outreach"] })
    .input(contactIdInputSchema)
    .output(okResponseSchema)
    .handler(async ({ input }) => {
      await db.outreachContact.delete({ where: { id: input.id } });
      return { status: "ok" as const };
    }),

  createInteraction: createOutreach
    .route({ method: "POST", path: "/interactions/create", tags: ["Outreach"] })
    .input(createInteractionInputSchema)
    .output(interactionResponseSchema)
    .handler(async ({ context, input }) => {
      const interaccion = await db.outreachInteraction.create({
        data: {
          establecimientoRbd: input.establecimientoRbd,
          contactoId: input.contactoId ?? null,
          tipo: input.tipo,
          fecha: input.fecha,
          asunto: input.asunto ?? null,
          contenido: input.contenido,
          emailDesde: input.emailDesde ?? null,
          emailHacia: input.emailHacia ?? null,
          resultado: input.resultado ?? null,
          creadoPorUserId: context.user.id,
          creadoPorNombre: context.user.email ?? null,
        },
      });
      await db.outreachEstablishment.update({
        where: { rbd: input.establecimientoRbd },
        data: { ultimoContactoAt: input.fecha },
      });
      return { interaccion };
    }),

  deleteInteraction: deleteOutreach
    .route({ method: "POST", path: "/interactions/delete", tags: ["Outreach"] })
    .input(interactionIdInputSchema)
    .output(okResponseSchema)
    .handler(async ({ input }) => {
      await db.outreachInteraction.delete({ where: { id: input.id } });
      return { status: "ok" as const };
    }),

  listCampaigns: readOutreach
    .route({ method: "GET", path: "/campaigns", tags: ["Outreach"] })
    .input(z.object({}).optional())
    .output(listCampaignsResponseSchema)
    .handler(async () => {
      const campaigns = await db.outreachEmailCampaign.findMany({
        orderBy: { createdAt: "desc" },
      });
      return { campaigns: campaigns.map((c) => normalizeCampaign(c as Record<string, unknown>)) };
    }),

  getCampaign: readOutreach
    .route({ method: "POST", path: "/campaigns/get", tags: ["Outreach"] })
    .input(campaignIdInputSchema)
    .output(campaignDetailResponseSchema)
    .handler(async ({ input }) => {
      const campaign = await db.outreachEmailCampaign.findUnique({ where: { id: input.id } });
      if (!campaign) throw new ORPCError("NOT_FOUND", { message: "Campaña no encontrada" });
      const envios = await db.outreachEmailDelivery.findMany({
        where: { campaignId: input.id },
        orderBy: { createdAt: "desc" },
        take: 500,
      });
      return {
        campaign: normalizeCampaign(campaign as Record<string, unknown>),
        envios,
      };
    }),

  createCampaign: createOutreach
    .route({ method: "POST", path: "/campaigns/create", tags: ["Outreach"] })
    .input(createCampaignInputSchema)
    .output(campaignResponseSchema)
    .handler(async ({ context, input }) => {
      const campaign = await db.outreachEmailCampaign.create({
        data: {
          nombre: input.nombre,
          asunto: input.asunto,
          cuerpoHtml: input.cuerpoHtml,
          cuerpoTexto: input.cuerpoTexto,
          fromEmail: input.fromEmail,
          fromNombre: input.fromNombre,
          replyTo: input.replyTo ?? null,
          filtros: input.filtros ?? {},
          ratePerHour: input.ratePerHour ?? 50,
          createdByUserId: context.user.id,
        },
      });
      return { campaign: normalizeCampaign(campaign as Record<string, unknown>) };
    }),

  updateCampaign: updateOutreach
    .route({ method: "POST", path: "/campaigns/update", tags: ["Outreach"] })
    .input(updateCampaignInputSchema)
    .output(campaignResponseSchema)
    .handler(async ({ input }) => {
      const { id, ...rest } = input;
      const data: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(rest)) {
        if (v !== undefined) data[k] = v;
      }
      const campaign = await db.outreachEmailCampaign.update({ where: { id }, data });
      return { campaign: normalizeCampaign(campaign as Record<string, unknown>) };
    }),

  deleteCampaign: deleteOutreach
    .route({ method: "POST", path: "/campaigns/delete", tags: ["Outreach"] })
    .input(campaignIdInputSchema)
    .output(okResponseSchema)
    .handler(async ({ input }) => {
      await db.outreachEmailCampaign.delete({ where: { id: input.id } });
      return { status: "ok" as const };
    }),

  previewCampaign: readOutreach
    .route({ method: "POST", path: "/campaigns/preview", tags: ["Outreach"] })
    .input(previewCampaignInputSchema)
    .output(campaignPreviewResponseSchema)
    .handler(async ({ input }) => {
      const candidates = await selectCandidates({ ...input.filtros, soloConEmail: false });
      const conEmail = candidates.filter((c) => c.email).length;
      const sample = input.sampleRbd
        ? candidates.find((c) => c.establishment.rbd === input.sampleRbd) ?? candidates[0]
        : candidates[0];
      const ctx = sample
        ? { establishment: sample.establishment, contact: sample.contact }
        : null;
      return {
        totalCandidatos: candidates.length,
        conEmail,
        sinEmail: candidates.length - conEmail,
        rendered: {
          asunto: ctx ? renderTemplate(input.asunto, ctx) : input.asunto,
          cuerpoHtml: ctx ? renderTemplate(input.cuerpoHtml, ctx) : input.cuerpoHtml,
          cuerpoTexto: ctx ? renderTemplate(input.cuerpoTexto, ctx) : input.cuerpoTexto,
          establecimiento: ctx?.establishment ?? null,
        },
        destinatarios: candidates.slice(0, 200).map((c) => ({
          rbd: c.establishment.rbd,
          nombre: c.establishment.nombre,
          comuna: c.establishment.comuna,
          email: c.email || null,
        })),
      };
    }),

  launchCampaign: updateOutreach
    .route({ method: "POST", path: "/campaigns/launch", tags: ["Outreach"] })
    .input(launchCampaignInputSchema)
    .output(campaignResponseSchema)
    .handler(async ({ input }) => {
      await buildCampaignDeliveries(input.id);
      const campaign = await db.outreachEmailCampaign.update({
        where: { id: input.id },
        data: { estado: "ENVIANDO", enviadoEn: new Date() },
      });
      return { campaign: normalizeCampaign(campaign as Record<string, unknown>) };
    }),

  pauseCampaign: updateOutreach
    .route({ method: "POST", path: "/campaigns/pause", tags: ["Outreach"] })
    .input(campaignIdInputSchema)
    .output(campaignResponseSchema)
    .handler(async ({ input }) => {
      const campaign = await db.outreachEmailCampaign.update({
        where: { id: input.id },
        data: { estado: "PAUSADA" },
      });
      return { campaign: normalizeCampaign(campaign as Record<string, unknown>) };
    }),

  nextDeliveryBatch: updateOutreach
    .route({ method: "POST", path: "/campaigns/next-batch", tags: ["Outreach"] })
    .input(nextDeliveryBatchInputSchema)
    .output(nextDeliveryBatchResponseSchema)
    .handler(async ({ input }) => {
      const campaign = await db.outreachEmailCampaign.findUnique({
        where: { id: input.campaignId },
      });
      if (!campaign) throw new ORPCError("NOT_FOUND", { message: "Campaña no encontrada" });
      if (campaign.estado !== "ENVIANDO") {
        return { items: [], remaining: 0 };
      }
      const sinceHour = new Date(Date.now() - 60 * 60 * 1000);
      const sentLastHour = await db.outreachEmailDelivery.count({
        where: {
          campaignId: input.campaignId,
          estado: "ENVIADO",
          enviadoEn: { gte: sinceHour },
        },
      });
      const cap = Math.max(0, campaign.ratePerHour - sentLastHour);
      const limit = Math.min(input.limit, cap);
      if (limit <= 0) {
        const remaining = await db.outreachEmailDelivery.count({
          where: { campaignId: input.campaignId, estado: "PENDIENTE" },
        });
        return { items: [], remaining };
      }
      const pending = await db.outreachEmailDelivery.findMany({
        where: { campaignId: input.campaignId, estado: "PENDIENTE" },
        include: { establishment: { select: { nombre: true } } },
        orderBy: { id: "asc" },
        take: limit,
      });
      const remaining = await db.outreachEmailDelivery.count({
        where: { campaignId: input.campaignId, estado: "PENDIENTE" },
      });
      return {
        items: pending.map((d) => ({
          deliveryId: d.id,
          emailDestinatario: d.emailDestinatario,
          asunto: d.asuntoRender ?? campaign.asunto,
          cuerpoHtml: d.cuerpoHtmlRender ?? campaign.cuerpoHtml,
          cuerpoTexto: d.cuerpoTextoRender ?? campaign.cuerpoTexto,
          fromEmail: campaign.fromEmail,
          fromNombre: campaign.fromNombre,
          replyTo: campaign.replyTo,
          establecimientoNombre: d.establishment.nombre,
        })),
        remaining,
      };
    }),

  recordDeliveryResult: updateOutreach
    .route({ method: "POST", path: "/campaigns/record-result", tags: ["Outreach"] })
    .input(recordDeliveryResultInputSchema)
    .output(okResponseSchema)
    .handler(async ({ context, input }) => {
      const delivery = await db.outreachEmailDelivery.findUnique({
        where: { id: input.deliveryId },
      });
      if (!delivery) throw new ORPCError("NOT_FOUND", { message: "Delivery no encontrado" });
      const enviado = input.status === "ENVIADO";
      await db.outreachEmailDelivery.update({
        where: { id: input.deliveryId },
        data: {
          estado: input.status,
          errorMensaje: input.errorMensaje ?? null,
          enviadoEn: enviado ? new Date() : null,
          intentos: { increment: 1 },
        },
      });
      const campaign = await db.outreachEmailCampaign.findUnique({
        where: { id: delivery.campaignId },
      });
      if (campaign) {
        const inc: Record<string, { increment: number }> = {};
        if (enviado) inc.enviados = { increment: 1 };
        else inc.errores = { increment: 1 };
        await db.outreachEmailCampaign.update({ where: { id: campaign.id }, data: inc });
        const stillPending = await db.outreachEmailDelivery.count({
          where: { campaignId: campaign.id, estado: "PENDIENTE" },
        });
        if (stillPending === 0 && campaign.estado === "ENVIANDO") {
          await db.outreachEmailCampaign.update({
            where: { id: campaign.id },
            data: { estado: "COMPLETADA" },
          });
        }
      }
      if (enviado) {
        await db.outreachInteraction.create({
          data: {
            establecimientoRbd: delivery.establecimientoRbd,
            contactoId: delivery.contactoId,
            tipo: "EMAIL_ENVIADO",
            fecha: new Date(),
            asunto: delivery.asuntoRender,
            contenido: delivery.cuerpoTextoRender ?? "",
            emailHacia: delivery.emailDestinatario,
            creadoPorUserId: context.user.id,
            creadoPorNombre: "Campaña automática",
          },
        });
        await db.outreachEstablishment.update({
          where: { rbd: delivery.establecimientoRbd },
          data: {
            ultimoContactoAt: new Date(),
            estado: "CONTACTADO",
          },
        });
      }
      return { status: "ok" as const };
    }),

  zonas: readOutreach
    .route({ method: "GET", path: "/zonas", tags: ["Outreach"] })
    .input(z.object({}).optional())
    .output(zonasResponseSchema)
    .handler(async () => ({
      zonas: ZONAS,
      categorias: [...CATEGORIAS_GOOGLE_PLACES],
    })),

  discoverGooglePlaces: createOutreach
    .route({ method: "POST", path: "/discover/google-places", tags: ["Outreach"] })
    .input(discoverGooglePlacesInputSchema)
    .output(discoverGooglePlacesResponseSchema)
    .handler(async ({ input }) => {
      const zona = input.customZona ?? ZONAS[input.zonaIndex ?? 0];
      if (!zona) throw new ORPCError("BAD_REQUEST", { message: "Zona inválida" });
      const result = await discoverGooglePlaces({
        lat: zona.lat,
        lng: zona.lng,
        radius: zona.radio,
        type: input.type,
        textQuery: input.textQuery,
        ciudad: input.ciudad ?? zona.ciudad,
        region: input.region ?? "Bío Bío",
        maxResults: input.maxResults,
      });
      return result;
    }),

  crawlProspect: updateOutreach
    .route({ method: "POST", path: "/enrich/crawl", tags: ["Outreach"] })
    .input(crawlProspectInputSchema)
    .output(crawlProspectResponseSchema)
    .handler(async ({ input }) => {
      const r = await runCrawler(input.rbd);
      await recomputeProspectScore(input.rbd).catch(() => undefined);
      return r;
    }),

  apolloEnrich: updateOutreach
    .route({ method: "POST", path: "/enrich/apollo", tags: ["Outreach"] })
    .input(apolloEnrichInputSchema)
    .output(apolloEnrichResponseSchema)
    .handler(async ({ input }) => {
      const r = await enrichProspectWithApollo(input.rbd);
      await recomputeProspectScore(input.rbd).catch(() => undefined);
      return {
        contactsCreated: r.contactsCreated,
        organizationName: r.organization?.name ?? null,
        apolloOrgId: r.organization?.id ?? null,
        peopleFound: r.people.length,
      };
    }),

  hunterDomain: updateOutreach
    .route({ method: "POST", path: "/enrich/hunter-domain", tags: ["Outreach"] })
    .input(hunterDomainInputSchema)
    .output(hunterDomainResponseSchema)
    .handler(async ({ input }) => {
      const data = await hunterEnrichProspect(input.rbd);
      await recomputeProspectScore(input.rbd).catch(() => undefined);
      return {
        domain: data.domain,
        pattern: data.pattern,
        organization: data.organization,
        contactsCreated: data.emails.length,
        emailsFound: data.emails.length,
      };
    }),

  hunterVerifyEmail: updateOutreach
    .route({ method: "POST", path: "/enrich/hunter-verify", tags: ["Outreach"] })
    .input(hunterVerifyEmailInputSchema)
    .output(hunterVerifyResponseSchema)
    .handler(async ({ input }) => {
      const r = await verifyEmail(input.email);
      return {
        email: r.email,
        result: r.result,
        score: r.score,
        status: r.status,
        smtp_check: r.smtp_check,
        disposable: r.disposable,
        webmail: r.webmail,
      };
    }),

  bulkCrawl: updateOutreach
    .route({ method: "POST", path: "/enrich/bulk-crawl", tags: ["Outreach"] })
    .input(bulkCrawlInputSchema)
    .output(bulkCrawlStartResponseSchema)
    .handler(async ({ input }) => {
      const where: Record<string, unknown> = { activo: true };
      if (input.tipos?.length) where.tipo = { in: input.tipos };
      if (input.fuentes?.length) where.fuente = { in: input.fuentes };
      if (input.comunas?.length) where.comuna = { in: input.comunas };
      if (input.soloConWebsite) where.websiteUrl = { not: null };
      if (input.soloSinEmail) {
        where.AND = [
          { OR: [{ emailMineduc: null }, { emailMineduc: "" }] },
          { emailsAdicionales: { equals: [] } },
        ];
      }
      if (input.saltarRecientes) {
        const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        where.OR = [
          ...(Array.isArray(where.OR) ? (where.OR as unknown[]) : []),
          { crawledAt: null },
          { crawledAt: { lt: cutoff } },
        ];
      }
      const targets = await db.outreachEstablishment.findMany({
        where,
        select: { rbd: true },
        take: input.limit,
      });
      const total = targets.length;
      const jobId = startJob("outreach-bulk-crawl", total);
      void runBulkCrawl(jobId, targets.map((t) => t.rbd)).catch((err) => {
        failJob(jobId, err instanceof Error ? err.message : String(err));
      });
      return { jobId, total };
    }),

  bulkCrawlStatus: readOutreach
    .route({ method: "POST", path: "/enrich/bulk-crawl-status", tags: ["Outreach"] })
    .input(bulkCrawlStatusInputSchema)
    .output(bulkCrawlStatusResponseSchema)
    .handler(async ({ input }) => {
      const job = getJobStatus(input.jobId);
      if (!job) throw new ORPCError("NOT_FOUND", { message: "Job no encontrado o expirado" });
      const result =
        job.status === "completed" && job.result
          ? (job.result as {
              successful: number;
              failed: number;
              emailsFound: number;
              phonesFound: number;
            })
          : null;
      return {
        jobId: job.id,
        status: job.status,
        progress: job.progress,
        total: job.total,
        message: job.message,
        error: job.error,
        result,
      };
    }),

  recomputeScore: updateOutreach
    .route({ method: "POST", path: "/enrich/recompute-score", tags: ["Outreach"] })
    .input(recomputeScoreInputSchema)
    .output(scoreResponseSchema)
    .handler(async ({ input }) => recomputeProspectScore(input.rbd)),

  importMineduc: createOutreach
    .route({ method: "POST", path: "/import/mineduc", tags: ["Outreach"] })
    .input(importMineducInputSchema)
    .output(importMineducResponseSchema)
    .handler(async ({ context, input }) => {
      const csvText = input.csvBase64
        ? Buffer.from(input.csvBase64, "base64").toString("latin1")
        : undefined;
      await importMineducDataset({
        source: input.source,
        url: input.url,
        csvText,
        comunas: input.comunas,
        dryRun: input.dryRun,
        createdByUserId: context.user.id,
      });
      const log = await db.outreachImportLog.findFirst({ orderBy: { startedAt: "desc" } });
      if (!log) throw new ORPCError("INTERNAL_SERVER_ERROR", { message: "Log no encontrado" });
      return { log };
    }),

  dashboard: readOutreach
    .route({ method: "GET", path: "/dashboard", tags: ["Outreach"] })
    .input(z.object({}).optional())
    .output(dashboardResponseSchema)
    .handler(async () => {
      const [
        total,
        activos,
        conEmail,
        porEstado,
        porDep,
        porComuna,
        porTipo,
        porFuente,
        porTipoEstado,
      ] = await Promise.all([
        db.outreachEstablishment.count(),
        db.outreachEstablishment.count({ where: { activo: true } }),
        db.outreachEstablishment.count({ where: { emailMineduc: { not: null } } }),
        db.outreachEstablishment.groupBy({ by: ["estado"], _count: { _all: true } }),
        db.outreachEstablishment.groupBy({ by: ["dependencia"], _count: { _all: true } }),
        db.outreachEstablishment.groupBy({ by: ["comuna"], _count: { _all: true } }),
        db.outreachEstablishment.groupBy({ by: ["tipo"], _count: { _all: true } }),
        db.outreachEstablishment.groupBy({ by: ["fuente"], _count: { _all: true } }),
        db.outreachEstablishment.groupBy({
          by: ["tipo", "estado"],
          _count: { _all: true },
        }),
      ]);
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const pendientesSeguimiento = await db.outreachEstablishment.count({
        where: {
          estado: "CONTACTADO",
          ultimoContactoAt: { lt: sevenDaysAgo },
        },
      });
      const ultimas = await db.outreachInteraction.findMany({
        orderBy: { createdAt: "desc" },
        take: 20,
        include: { establishment: { select: { nombre: true } } },
      });
      return {
        totales: {
          establecimientos: total,
          activos,
          conEmail,
        },
        porEstado: porEstado.map((r) => ({ estado: r.estado, count: r._count._all })),
        porTipo: porTipo.map((r) => ({ tipo: r.tipo, count: r._count._all })),
        porFuente: porFuente.map((r) => ({ fuente: r.fuente, count: r._count._all })),
        porDependencia: porDep.map((r) => ({ dependencia: r.dependencia, count: r._count._all })),
        porComuna: porComuna
          .map((r) => ({ comuna: r.comuna, count: r._count._all }))
          .sort((a, b) => b.count - a.count),
        porTipoEstado: porTipoEstado.map((r) => ({
          tipo: r.tipo,
          estado: r.estado,
          count: r._count._all,
        })),
        pendientesSeguimiento,
        ultimasInteracciones: ultimas.map((i) => ({
          ...i,
          establishmentNombre: i.establishment.nombre,
        })),
      };
    }),
};

export const outreachORPCRouter = base.prefix("/api/orpc/outreach").router(outreachRouterBase);

export const outreachORPCHandler = new SuperJSONRPCHandler(outreachORPCRouter, {
  interceptors: [
    onError((error) => {
      logError(error, { module: "api", operation: "orpc.outreach" });
    }),
  ],
});

export const outreachOpenAPIHandler = new OpenAPIHandler(outreachORPCRouter, {
  plugins: [
    new OpenAPIReferencePlugin({
      schemaConverters: [new ZodToJsonSchemaConverter()],
      specGenerateOptions: {
        info: {
          title: "Bioalergia Outreach oRPC",
          description: "Contratos oRPC para outreach a establecimientos educacionales.",
          version: "1.0.0",
        },
      },
    }),
  ],
  interceptors: [
    onError((error) => {
      logError(error, { module: "api", operation: "openapi.outreach" });
    }),
  ],
});

export type OutreachORPCRouter = typeof outreachORPCRouter;
