import type { JobPostingDTO } from "@finanzas/orpc-contracts/job-radar";

// Dedup cross-source EN DISPLAY (no destructivo: la DB mantiene todas las filas).
// Una misma oferta puede aparecer en 2 fuentes (ej. una empresa en Teamtailor que
// además publica en GetOnBoard). Agrupamos por título normalizado + empleador, así
// NO se mergean cargos homónimos de empresas distintas ("Analista de Riesgo" en dos
// empresas siguen separados).

export type DedupedPosting = JobPostingDTO & { alsoOn?: string[] };

function norm(s: string): string {
  return s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

// GetOnBoard guarda el título como "Cargo · Empleador" (company fija = "getonbrd").
// Separamos para obtener el empleador real y poder cruzar con otras fuentes.
function titleAndEmployer(p: JobPostingDTO): { title: string; employer: string } {
  if (p.source === "getonbrd") {
    const idx = p.title.lastIndexOf(" · ");
    if (idx > 0) return { title: p.title.slice(0, idx), employer: p.title.slice(idx + 3) };
  }
  return { title: p.title, employer: p.company };
}

// Preferimos el board directo del empleador sobre el agregador para la fila primaria.
const PRIORITY = ["teamtailor", "greenhouse", "lever", "bci", "getonbrd"];
function rank(source: string): number {
  const i = PRIORITY.indexOf(source);
  return i === -1 ? PRIORITY.length : i;
}

export function dedupePostings(postings: JobPostingDTO[]): DedupedPosting[] {
  const groups = new Map<string, JobPostingDTO[]>();
  for (const p of postings) {
    const { title, employer } = titleAndEmployer(p);
    const key = `${norm(title)}@${norm(employer)}`;
    const arr = groups.get(key);
    if (arr) arr.push(p);
    else groups.set(key, [p]);
  }

  const out: DedupedPosting[] = [];
  for (const arr of groups.values()) {
    const sorted = [...arr].sort(
      (a, b) =>
        rank(a.source) - rank(b.source) ||
        Number(Boolean(b.descriptionHtml)) - Number(Boolean(a.descriptionHtml)) ||
        new Date(b.firstSeenAt).getTime() - new Date(a.firstSeenAt).getTime()
    );
    const primary = sorted[0];
    if (!primary) continue;
    const alsoOn = [...new Set(sorted.slice(1).map((p) => p.source))].filter(
      (s) => s !== primary.source
    );
    out.push(alsoOn.length > 0 ? { ...primary, alsoOn } : primary);
  }
  return out;
}
