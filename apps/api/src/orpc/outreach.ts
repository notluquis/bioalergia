import type { OutreachCampaign, OutreachCampaignFilters } from "@finanzas/orpc-contracts/outreach";
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
  okResponseSchema,
  outreachSendBatchResponseSchema,
  previewCampaignInputSchema,
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
import { getSessionUser, hasPermission } from "../lib/auth.ts";
import { logError } from "../lib/logger.ts";
import { configureSuperjson } from "../lib/superjson-config.ts";
import {
  completeJob,
  failJob,
  getJobStatus,
  startJob,
  updateJobProgress,
} from "../lib/job-queue/jobQueue.ts";
import { enqueueJob } from "../queue/runner.ts";
import { outreachDrainJobKey } from "../queue/tasks/outreach-send.ts";
import { enrichProspectWithApollo } from "../modules/outreach/apollo.ts";
import { selectCandidates } from "../modules/outreach/campaign-builder.ts";
import { discoverGooglePlaces } from "../modules/outreach/google-places.ts";
import { hunterEnrichProspect, verifyEmail } from "../modules/outreach/hunter.ts";
import { importMineducDataset } from "../modules/outreach/mineduc-importer.ts";
import {
  bulkUpdateEstablishments,
  createCampaign,
  createInteraction,
  deleteCampaign,
  deleteContact,
  deleteInteraction,
  getCampaignDetail,
  getDashboard,
  getEstablishmentDetail,
  getFiltersMeta,
  getLatestImportLog,
  launchOrResumeCampaign,
  listCampaigns,
  listEstablishments,
  pauseCampaign,
  selectBulkCrawlTargets,
  updateCampaign,
  updateEstablishment,
  upsertContact,
} from "../services/outreach-campaign.ts";
import { sendOutreachNextBatch } from "../services/outreach-email.ts";
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
    const rbd = rbds[i];
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

const outreachRouterBase = {
  listEstablishments: readOutreach
    .route({ method: "POST", path: "/establishments/list", tags: ["Outreach"] })
    .input(listEstablishmentsInputSchema)
    .output(listEstablishmentsResponseSchema)
    .handler(async ({ input }) => listEstablishments(input)),

  getEstablishment: readOutreach
    .route({ method: "POST", path: "/establishments/get", tags: ["Outreach"] })
    .input(establishmentRbdInputSchema)
    .output(establishmentDetailResponseSchema)
    .handler(async ({ input }) => getEstablishmentDetail(input.rbd)),

  updateEstablishment: updateOutreach
    .route({ method: "POST", path: "/establishments/update", tags: ["Outreach"] })
    .input(updateEstablishmentInputSchema)
    .output(establishmentResponseSchema)
    .handler(async ({ input }) => ({ establishment: await updateEstablishment(input) })),

  bulkUpdateEstablishments: updateOutreach
    .route({ method: "POST", path: "/establishments/bulk-update", tags: ["Outreach"] })
    .input(bulkUpdateEstablishmentsInputSchema)
    .output(z.object({ updated: z.number().int() }))
    .handler(async ({ input }) => ({ updated: await bulkUpdateEstablishments(input) })),

  filtersMeta: readOutreach
    .route({ method: "GET", path: "/filters", tags: ["Outreach"] })
    .input(z.object({}).optional())
    .output(filtersResponseSchema)
    .handler(async () => getFiltersMeta()),

  upsertContact: updateOutreach
    .route({ method: "POST", path: "/contacts/upsert", tags: ["Outreach"] })
    .input(upsertContactInputSchema)
    .output(contactResponseSchema)
    .handler(async ({ input }) => ({ contacto: await upsertContact(input) })),

  deleteContact: deleteOutreach
    .route({ method: "POST", path: "/contacts/delete", tags: ["Outreach"] })
    .input(contactIdInputSchema)
    .output(okResponseSchema)
    .handler(async ({ input }) => {
      await deleteContact(input.id);
      return { status: "ok" as const };
    }),

  createInteraction: createOutreach
    .route({ method: "POST", path: "/interactions/create", tags: ["Outreach"] })
    .input(createInteractionInputSchema)
    .output(interactionResponseSchema)
    .handler(async ({ context, input }) => ({
      interaccion: await createInteraction(input, context.user),
    })),

  deleteInteraction: deleteOutreach
    .route({ method: "POST", path: "/interactions/delete", tags: ["Outreach"] })
    .input(interactionIdInputSchema)
    .output(okResponseSchema)
    .handler(async ({ input }) => {
      await deleteInteraction(input.id);
      return { status: "ok" as const };
    }),

  listCampaigns: readOutreach
    .route({ method: "GET", path: "/campaigns", tags: ["Outreach"] })
    .input(z.object({}).optional())
    .output(listCampaignsResponseSchema)
    .handler(async () => {
      const campaigns = await listCampaigns();
      return { campaigns: campaigns.map((c) => normalizeCampaign(c as Record<string, unknown>)) };
    }),

  getCampaign: readOutreach
    .route({ method: "POST", path: "/campaigns/get", tags: ["Outreach"] })
    .input(campaignIdInputSchema)
    .output(campaignDetailResponseSchema)
    .handler(async ({ input }) => {
      const { campaign, envios } = await getCampaignDetail(input.id);
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
      const campaign = await createCampaign(input, context.user);
      return { campaign: normalizeCampaign(campaign as Record<string, unknown>) };
    }),

  updateCampaign: updateOutreach
    .route({ method: "POST", path: "/campaigns/update", tags: ["Outreach"] })
    .input(updateCampaignInputSchema)
    .output(campaignResponseSchema)
    .handler(async ({ input }) => {
      const campaign = await updateCampaign(input);
      return { campaign: normalizeCampaign(campaign as Record<string, unknown>) };
    }),

  deleteCampaign: deleteOutreach
    .route({ method: "POST", path: "/campaigns/delete", tags: ["Outreach"] })
    .input(campaignIdInputSchema)
    .output(okResponseSchema)
    .handler(async ({ input }) => {
      await deleteCampaign(input.id);
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
        ? (candidates.find((c) => c.establishment.rbd === input.sampleRbd) ?? candidates[0])
        : candidates[0];
      const ctx = sample ? { establishment: sample.establishment, contact: sample.contact } : null;
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
      const campaign = await launchOrResumeCampaign(input.id);
      // Kick off the auto-drain chain (queue paces sends to ratePerHour). The
      // jobKey + replace mode means a relaunch/resume never spawns a parallel
      // chain. No-ops when the queue runner is disabled — the manual
      // "Enviar siguiente lote" button stays as the fallback path.
      await enqueueJob(
        "send_outreach_tick",
        { campaignId: input.id },
        { jobKey: outreachDrainJobKey(input.id), jobKeyMode: "replace" }
      );
      return { campaign: normalizeCampaign(campaign as Record<string, unknown>) };
    }),

  pauseCampaign: updateOutreach
    .route({ method: "POST", path: "/campaigns/pause", tags: ["Outreach"] })
    .input(campaignIdInputSchema)
    .output(campaignResponseSchema)
    .handler(async ({ input }) => {
      const campaign = await pauseCampaign(input.id);
      return { campaign: normalizeCampaign(campaign as Record<string, unknown>) };
    }),

  sendBatch: updateOutreach
    .route({ method: "POST", path: "/campaigns/send-batch", tags: ["Outreach"] })
    .input(nextDeliveryBatchInputSchema)
    .output(outreachSendBatchResponseSchema)
    .handler(async ({ input }) => {
      return sendOutreachNextBatch(input.campaignId, input.limit);
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
      const rbds = await selectBulkCrawlTargets(input);
      const total = rbds.length;
      const jobId = startJob("outreach-bulk-crawl", total);
      void runBulkCrawl(jobId, rbds).catch((err) => {
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
      const log = await getLatestImportLog();
      if (!log) throw new ORPCError("INTERNAL_SERVER_ERROR", { message: "Log no encontrado" });
      return { log };
    }),

  dashboard: readOutreach
    .route({ method: "GET", path: "/dashboard", tags: ["Outreach"] })
    .input(z.object({}).optional())
    .output(dashboardResponseSchema)
    .handler(async () => getDashboard()),
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
