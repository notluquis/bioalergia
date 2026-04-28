import { db } from "@finanzas/db";
import type {
  OutreachCampaignFilters,
  OutreachContact,
  OutreachEstablishment,
} from "@finanzas/orpc-contracts/outreach";
import { renderTemplate } from "./template";

export type CandidateRow = {
  establishment: OutreachEstablishment;
  contact: OutreachContact | null;
  email: string;
};

export async function selectCandidates(filters: OutreachCampaignFilters): Promise<CandidateRow[]> {
  const where: Record<string, unknown> = { activo: true };
  if (filters.dependencias?.length) where.dependencia = { in: filters.dependencias };
  if (filters.comunas?.length) where.comuna = { in: filters.comunas };
  if (filters.estados?.length) where.estado = { in: filters.estados };
  if (filters.prioridades?.length) where.prioridad = { in: filters.prioridades };
  if (filters.etiquetas?.length) where.etiquetas = { hasSome: filters.etiquetas };
  if (filters.excludeRbds?.length) where.rbd = { notIn: filters.excludeRbds };

  const list = await db.outreachEstablishment.findMany({
    where,
    include: {
      contactos: { where: { esPrincipal: true }, take: 1 },
    },
  });

  const rows: CandidateRow[] = [];
  for (const e of list) {
    const principal = e.contactos[0] ?? null;
    const email = principal?.email ?? e.emailMineduc ?? e.emailsAdicionales[0] ?? null;
    if (filters.soloConEmail !== false && !email) continue;
    rows.push({
      establishment: e as unknown as OutreachEstablishment,
      contact: (principal as unknown as OutreachContact) ?? null,
      email: email ?? "",
    });
  }
  return rows;
}

export async function buildCampaignDeliveries(campaignId: number): Promise<number> {
  const campaign = await db.outreachEmailCampaign.findUnique({ where: { id: campaignId } });
  if (!campaign) throw new Error("Campaña no encontrada");
  const filters = (campaign.filtros ?? {}) as OutreachCampaignFilters;
  const candidates = await selectCandidates(filters);

  await db.outreachEmailDelivery.deleteMany({
    where: { campaignId, estado: "PENDIENTE" },
  });

  for (const c of candidates) {
    if (!c.email) continue;
    const ctx = { establishment: c.establishment, contact: c.contact };
    await db.outreachEmailDelivery.create({
      data: {
        campaignId,
        establecimientoRbd: c.establishment.rbd,
        contactoId: c.contact?.id ?? null,
        emailDestinatario: c.email,
        asuntoRender: renderTemplate(campaign.asunto, ctx),
        cuerpoHtmlRender: renderTemplate(campaign.cuerpoHtml, ctx),
        cuerpoTextoRender: renderTemplate(campaign.cuerpoTexto, ctx),
        estado: "PENDIENTE",
      },
    });
  }

  await db.outreachEmailCampaign.update({
    where: { id: campaignId },
    data: { totalDestinatarios: candidates.length },
  });

  return candidates.length;
}
