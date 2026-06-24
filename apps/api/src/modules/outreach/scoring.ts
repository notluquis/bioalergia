import { db } from "@finanzas/db";

const RRHH_TITLE_RX = /(rrhh|recursos humanos|bienestar|personas|talento|hr\b)/i;

export async function computeScore(rbd: string): Promise<number> {
  const prospect = await db.outreachEstablishment.findUnique({
    where: { rbd },
    include: { contactos: true },
  });
  if (!prospect) return 0;

  let score = 0;
  if (prospect.emailMineduc || prospect.emailsAdicionales.length > 0) score += 30;
  if (prospect.telefonoMineduc || prospect.telefonosAdicionales.length > 0) score += 15;
  if (prospect.linkedinUrl) score += 10;
  if (prospect.contactos.some((c: { cargo: string }) => RRHH_TITLE_RX.test(c.cargo))) score += 25;
  if ((prospect.totalReviews ?? 0) > 100) score += 10;
  if ((prospect.totalReviews ?? 0) > 500) score += 10;
  return Math.min(100, score);
}

export function priorityFromScore(score: number): "ALTA" | "MEDIA" | "BAJA" {
  if (score >= 70) return "ALTA";
  if (score >= 40) return "MEDIA";
  return "BAJA";
}

export async function recomputeProspectScore(rbd: string): Promise<{ score: number }> {
  const score = await computeScore(rbd);
  await db.outreachEstablishment.update({
    where: { rbd },
    data: { score, prioridad: priorityFromScore(score) },
  });
  return { score };
}
