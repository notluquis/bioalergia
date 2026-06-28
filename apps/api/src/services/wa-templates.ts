// Lógica de negocio de plantillas de WhatsApp Cloud, fuera de los handlers
// oRPC (golden 2026: handlers finos). Estos servicios orquestan la llamada a la
// Graph API de Meta (modules/wa-cloud/graph/*) MÁS la persistencia local en
// db.waTemplate, dejando los handlers como: authz → service → return.

import { db } from "@finanzas/db";
import type {
  cloneTemplateFromLibraryInputSchema,
  createTemplateInputSchema,
  listTemplateLibraryInputSchema,
  listTemplatesResponseSchema,
  syncTemplatesResponseSchema,
  waTemplateSchema,
} from "@finanzas/orpc-contracts/wa-cloud";
import type { z } from "zod";
import { logError, logEvent } from "../lib/logger.ts";
import {
  cloneTemplateFromLibrary as graphCloneTemplateFromLibrary,
  createTemplate as graphCreateTemplate,
  deleteTemplate as graphDeleteTemplate,
  listAccountTemplates,
  listTemplateLibrary as graphListTemplateLibrary,
} from "../modules/wa-cloud/graph-client.ts";

type CreateTemplatePayload = z.infer<typeof createTemplateInputSchema>;
type CloneTemplatePayload = z.infer<typeof cloneTemplateFromLibraryInputSchema>;
type ListTemplateLibraryPayload = z.infer<typeof listTemplateLibraryInputSchema>;

type TemplateRow = Awaited<ReturnType<typeof db.waTemplate.findMany>>[number];
type WaTemplateStatus = "PENDING" | "APPROVED" | "REJECTED" | "DISABLED" | "PAUSED";

type TemplateDto = z.infer<typeof waTemplateSchema>;

function toTemplateDto(row: TemplateRow): TemplateDto {
  return {
    id: row.id,
    accountId: row.accountId,
    name: row.name,
    language: row.language,
    category: row.category,
    status: row.status,
    components: (row.components as unknown[]) ?? [],
    qualityScore: row.qualityScore,
  };
}

// Trae las plantillas desde Meta y las upsertea en bloque (lookup batcheado por
// clave compuesta name+language), luego devuelve todas las locales del account.
export async function syncTemplates(
  accountId: number
): Promise<z.infer<typeof syncTemplatesResponseSchema>> {
  const apiTpls = await listAccountTemplates(accountId);
  // Single batched lookup: all existing templates for this account in
  // one query, indexed by composite key (name, language). Replaces the
  // N findUnique sequential roundtrips.
  const existingRows = await db.waTemplate.findMany({
    where: { accountId },
    select: { id: true, name: true, language: true },
  });
  const existingByKey = new Map(existingRows.map((r) => [`${r.name}\u0000${r.language}`, r.id]));
  await Promise.all(
    apiTpls.map((t) => {
      const data = {
        accountId,
        name: t.name,
        language: t.language,
        category: t.category as never,
        status: t.status as never,
        components: t.components as never,
        qualityScore: t.quality_score?.score ?? null,
        metaTemplateId: t.id,
        syncedAt: new Date(),
      };
      const existingId = existingByKey.get(`${t.name}\u0000${t.language}`);
      return existingId
        ? db.waTemplate.update({ where: { id: existingId }, data })
        : db.waTemplate.create({ data });
    })
  );
  const all = await db.waTemplate.findMany({
    where: { accountId },
    orderBy: { name: "asc" },
  });
  return {
    total: all.length,
    templates: all.map((t) => toTemplateDto(t)),
  };
}

export async function listTemplates(
  accountId?: number
): Promise<z.infer<typeof listTemplatesResponseSchema>> {
  const where = accountId ? { accountId } : {};
  const tpls = await db.waTemplate.findMany({ where, orderBy: { name: "asc" } });
  return { templates: tpls.map((t) => toTemplateDto(t)) };
}

// Crea la plantilla en Meta y la persiste localmente (best-effort) para que
// aparezca en la lista antes del próximo sync.
export async function createTemplate(payload: CreateTemplatePayload) {
  const r = await graphCreateTemplate({
    accountId: payload.accountId,
    name: payload.name,
    language: payload.language,
    category: payload.category,
    components: payload.components,
  });
  try {
    await db.waTemplate.upsert({
      where: {
        accountId_name_language: {
          accountId: payload.accountId,
          name: payload.name,
          language: payload.language,
        },
      },
      create: {
        accountId: payload.accountId,
        metaTemplateId: r.id,
        name: payload.name,
        language: payload.language,
        category: payload.category,
        status: r.status as WaTemplateStatus,
        components: payload.components as never,
      },
      update: {
        metaTemplateId: r.id,
        status: r.status as WaTemplateStatus,
      },
    });
  } catch (err) {
    logError("[wa-cloud.createTemplate] persist failed", { err });
  }
  return r;
}

// El endpoint /{waba}/message_template_library NO está expuesto en el tier
// público de WhatsApp Business API (Meta devuelve "nonexisting field"). En ese
// caso degradamos a catálogo vacío en vez de propagar el 400. Cualquier otro
// error sí se propaga.
export async function listTemplateLibrary(payload: ListTemplateLibraryPayload) {
  try {
    const templates = await graphListTemplateLibrary(payload.accountId, {
      category: payload.category,
      topic: payload.topic,
      industry: payload.industry,
      language: payload.language,
      search: payload.search,
    });
    return { templates };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const isTierError =
      message.includes("nonexisting field") || message.includes("message_template_library");
    if (!isTierError) throw err;
    logEvent("[wa-cloud.listTemplateLibrary] catalog browse not available", { message });
    return { templates: [] };
  }
}

// Clona una plantilla curada de la librería de Meta y la persiste localmente.
export async function cloneTemplateFromLibrary(payload: CloneTemplatePayload) {
  const r = await graphCloneTemplateFromLibrary({
    accountId: payload.accountId,
    libraryTemplateName: payload.libraryTemplateName,
    newName: payload.newName,
    language: payload.language,
    category: payload.category,
  });
  try {
    await db.waTemplate.upsert({
      where: {
        accountId_name_language: {
          accountId: payload.accountId,
          name: payload.newName ?? payload.libraryTemplateName,
          language: payload.language,
        },
      },
      create: {
        accountId: payload.accountId,
        metaTemplateId: r.id,
        name: payload.newName ?? payload.libraryTemplateName,
        language: payload.language,
        category: payload.category,
        status: r.status as WaTemplateStatus,
        components: [] as never,
      },
      update: {
        metaTemplateId: r.id,
        status: r.status as WaTemplateStatus,
      },
    });
  } catch (err) {
    logError("[wa-cloud.cloneTemplateFromLibrary] persist failed", { err });
  }
  return r;
}

// Borra la plantilla en Meta y limpia la copia local (best-effort).
export async function deleteTemplate(
  accountId: number,
  name: string,
  hsmId?: string
): Promise<void> {
  await graphDeleteTemplate(accountId, name, hsmId);
  try {
    await db.waTemplate.deleteMany({ where: { accountId, name } });
  } catch (err) {
    logError("[wa-cloud.deleteTemplate] local cleanup failed", { err });
  }
}
