import { db } from "@finanzas/db";
import type {
  bulkCrawlInputSchema,
  bulkUpdateEstablishmentsInputSchema,
  createCampaignInputSchema,
  createInteractionInputSchema,
  listEstablishmentsInputSchema,
  updateCampaignInputSchema,
  updateEstablishmentInputSchema,
  upsertContactInputSchema,
} from "@finanzas/orpc-contracts/outreach";
import type { z } from "zod";
import { DomainError } from "../lib/errors.ts";
import { sanitizeHtml } from "../lib/html-sanitizer.ts";
import { buildCampaignDeliveries } from "../modules/outreach/campaign-builder.ts";

// Lógica de negocio de outreach, fuera de los handlers oRPC. Los servicios
// validan y lanzan DomainError (mapeado a HTTP por orpc/error.ts::toORPCError
// vía el SuperJSONRPCHandler); los handlers quedan finos. El enqueue del
// drain chain queda en el handler (es el trigger de la cola, no DB business
// logic) — ver orpc/outreach.ts::launchCampaign.

// Launch (BORRADOR) or resume (PAUSADA) an outreach campaign. Returns the
// updated campaign row; the caller normalizes + kicks off the drain chain.
//
// Only a fresh launch rebuilds deliveries from the current filters. Resume
// keeps the existing PENDIENTE/ENVIADO rows so already-contacted
// establishments are never re-mailed.
export async function launchOrResumeCampaign(campaignId: number) {
  const existing = await db.outreachEmailCampaign.findUnique({ where: { id: campaignId } });
  if (!existing) throw new DomainError("NOT_FOUND", "Campaña no encontrada");
  if (existing.estado === "COMPLETADA") {
    throw new DomainError("CONFLICT", "La campaña ya está completada");
  }

  if (existing.estado === "BORRADOR") {
    await buildCampaignDeliveries(campaignId);
  }

  return db.outreachEmailCampaign.update({
    where: { id: campaignId },
    data: { estado: "ENVIANDO", enviadoEn: existing.enviadoEn ?? new Date() },
  });
}

// ── Establishments ────────────────────────────────────────────────────────

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
      { nombre: { contains: q, mode: "insensitive" as const } },
      { directorMineduc: { contains: q, mode: "insensitive" as const } },
      { emailMineduc: { contains: q, mode: "insensitive" as const } },
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

export async function listEstablishments(input: z.infer<typeof listEstablishmentsInputSchema>) {
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
  const cMap = new Map(
    contactCounts.map((r: (typeof contactCounts)[number]) => [r.establecimientoRbd, r._count._all])
  );
  const iMap = new Map<string, { count: number; last: Date | null }>(
    interactionAgg.map(
      (r: (typeof interactionAgg)[number]): [string, { count: number; last: Date | null }] => [
        r.establecimientoRbd,
        { count: r._count._all, last: r._max.fecha },
      ]
    )
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
}

export async function getEstablishmentDetail(rbd: string) {
  const establishment = await db.outreachEstablishment.findUnique({ where: { rbd } });
  if (!establishment) {
    throw new DomainError("NOT_FOUND", "Establecimiento no encontrado");
  }
  const [contactos, interacciones, envios] = await Promise.all([
    db.outreachContact.findMany({
      where: { establecimientoRbd: rbd },
      orderBy: [{ esPrincipal: "desc" }, { createdAt: "asc" }],
    }),
    db.outreachInteraction.findMany({
      where: { establecimientoRbd: rbd },
      orderBy: { fecha: "desc" },
      take: 100,
    }),
    db.outreachEmailDelivery.findMany({
      where: { establecimientoRbd: rbd },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
  ]);
  return { establishment, contactos, interacciones, envios };
}

export async function updateEstablishment(input: z.infer<typeof updateEstablishmentInputSchema>) {
  const { rbd, ...rest } = input;
  const data: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(rest)) {
    if (v !== undefined) data[k] = v;
  }
  return db.outreachEstablishment.update({ where: { rbd }, data });
}

export async function bulkUpdateEstablishments(
  input: z.infer<typeof bulkUpdateEstablishmentsInputSchema>
): Promise<number> {
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
        data: { etiquetas: Array.from(set) as string[] },
      });
    }
    if (!Object.keys(data).length) updated = items.length;
  }
  return updated;
}

export async function getFiltersMeta() {
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
}

// ── Contacts ──────────────────────────────────────────────────────────────

export async function upsertContact(input: z.infer<typeof upsertContactInputSchema>) {
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
  return input.id
    ? db.outreachContact.update({ where: { id: input.id }, data })
    : db.outreachContact.create({ data });
}

export async function deleteContact(id: number): Promise<void> {
  await db.outreachContact.delete({ where: { id } });
}

// ── Interactions ──────────────────────────────────────────────────────────

export async function createInteraction(
  input: z.infer<typeof createInteractionInputSchema>,
  user: { id: number; email?: string | null }
) {
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
      creadoPorUserId: user.id,
      creadoPorNombre: user.email ?? null,
    },
  });
  await db.outreachEstablishment.update({
    where: { rbd: input.establecimientoRbd },
    data: { ultimoContactoAt: input.fecha },
  });
  return interaccion;
}

export async function deleteInteraction(id: number): Promise<void> {
  await db.outreachInteraction.delete({ where: { id } });
}

// ── Campaigns ─────────────────────────────────────────────────────────────

export async function listCampaigns() {
  return db.outreachEmailCampaign.findMany({ orderBy: { createdAt: "desc" } });
}

export async function getCampaignDetail(id: number) {
  const campaign = await db.outreachEmailCampaign.findUnique({ where: { id } });
  if (!campaign) throw new DomainError("NOT_FOUND", "Campaña no encontrada");
  const envios = await db.outreachEmailDelivery.findMany({
    where: { campaignId: id },
    orderBy: { createdAt: "desc" },
    take: 500,
  });
  return { campaign, envios };
}

export async function createCampaign(
  input: z.infer<typeof createCampaignInputSchema>,
  user: { id: number }
) {
  return db.outreachEmailCampaign.create({
    data: {
      nombre: input.nombre,
      asunto: input.asunto,
      // Sanitize admin-authored campaign HTML before it is stored and later
      // emailed to recipients (XSS defense — DOMPurify RICH config).
      cuerpoHtml: sanitizeHtml(input.cuerpoHtml, "rich"),
      cuerpoTexto: input.cuerpoTexto,
      fromEmail: input.fromEmail,
      fromNombre: input.fromNombre,
      replyTo: input.replyTo ?? null,
      filtros: input.filtros ?? {},
      ratePerHour: input.ratePerHour ?? 50,
      createdByUserId: user.id,
    },
  });
}

export async function updateCampaign(input: z.infer<typeof updateCampaignInputSchema>) {
  const { id, ...rest } = input;
  const data: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(rest)) {
    if (v !== undefined) data[k] = v;
  }
  // Same XSS defense as createCampaign for the editable HTML body.
  if (typeof data.cuerpoHtml === "string") {
    data.cuerpoHtml = sanitizeHtml(data.cuerpoHtml, "rich");
  }
  return db.outreachEmailCampaign.update({ where: { id }, data });
}

export async function deleteCampaign(id: number): Promise<void> {
  await db.outreachEmailCampaign.delete({ where: { id } });
}

export async function pauseCampaign(id: number) {
  return db.outreachEmailCampaign.update({
    where: { id },
    data: { estado: "PAUSADA" },
  });
}

// ── Bulk crawl target selection ────────────────────────────────────────────

export async function selectBulkCrawlTargets(
  input: z.infer<typeof bulkCrawlInputSchema>
): Promise<string[]> {
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
  return targets.map((t) => t.rbd);
}

// ── Import log lookup ──────────────────────────────────────────────────────

// The importMineduc module writes the log row; the handler needs the latest
// one for the response. Returns null when none exists (handler maps that to a
// 500 — there is no DomainError kind for an internal/unexpected fault).
export async function getLatestImportLog() {
  return db.outreachImportLog.findFirst({ orderBy: { startedAt: "desc" } });
}

// ── Dashboard ──────────────────────────────────────────────────────────────

export async function getDashboard() {
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
    porEstado: porEstado.map((r: (typeof porEstado)[number]) => ({
      estado: r.estado,
      count: r._count._all,
    })),
    porTipo: porTipo.map((r: (typeof porTipo)[number]) => ({
      tipo: r.tipo,
      count: r._count._all,
    })),
    porFuente: porFuente.map((r: (typeof porFuente)[number]) => ({
      fuente: r.fuente,
      count: r._count._all,
    })),
    porDependencia: porDep.map((r: (typeof porDep)[number]) => ({
      dependencia: r.dependencia,
      count: r._count._all,
    })),
    porComuna: porComuna
      .map((r: (typeof porComuna)[number]) => ({ comuna: r.comuna, count: r._count._all }))
      .sort((a: { count: number }, b: { count: number }) => b.count - a.count),
    porTipoEstado: porTipoEstado.map((r: (typeof porTipoEstado)[number]) => ({
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
}
