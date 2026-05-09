import type {
  OutreachContact,
  OutreachEstablishment,
} from "@finanzas/orpc-contracts/outreach";

export type TemplateContext = {
  establishment: OutreachEstablishment;
  contact: OutreachContact | null;
};

const VARS = [
  "nombre_colegio",
  "nombre_director",
  "nombre_contacto",
  "comuna",
  "dependencia",
  "rbd",
];

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Mineduc stores `dependencia` upper-cased ("MUNICIPAL", "PARTICULAR
// SUBVENCIONADO", "CORPORACIÓN MUNICIPAL"). Templates are read by
// directors / parents — we render the value title-cased so the email
// body is not shouting at them.
function titleCaseEs(value: string): string {
  return value
    .toLocaleLowerCase("es")
    .split(/(\s+)/)
    .map((segment, idx) => {
      if (idx % 2 === 1) return segment;
      if (!segment) return segment;
      return segment.charAt(0).toLocaleUpperCase("es") + segment.slice(1);
    })
    .join("");
}

export function renderTemplate(template: string, ctx: TemplateContext): string {
  if (!template) return "";
  const values: Record<string, string> = {
    nombre_colegio: ctx.establishment.nombre,
    nombre_director: ctx.establishment.directorMineduc ?? "Director/a",
    nombre_contacto: ctx.contact?.nombre ?? ctx.establishment.directorMineduc ?? "Director/a",
    comuna: ctx.establishment.comuna,
    dependencia: titleCaseEs(ctx.establishment.dependencia),
    rbd: ctx.establishment.rbd,
  };
  let out = template;
  for (const v of VARS) {
    const re = new RegExp(`\\{\\{\\s*${escapeRegex(v)}\\s*\\}\\}`, "gi");
    out = out.replace(re, values[v] ?? "");
  }
  return out;
}

export const DEFAULT_CAMPAIGN_TEMPLATE = {
  asunto: "Charla educativa gratuita sobre alergias para {{nombre_colegio}}",
  cuerpoTexto: `Estimado/a {{nombre_director}},

Me dirijo a usted en nombre de Bioalergia, centro especializado en alergología e inmunología clínica ubicado en Concepción.

Nos gustaría ofrecerle una charla educativa gratuita para padres, apoderados y/o personal docente de {{nombre_colegio}} sobre alergias respiratorias, alimentarias y el único tratamiento curativo disponible: la inmunoterapia alérgica.

La charla es completamente sin costo, tiene una duración de 45-60 minutos y puede realizarse de forma presencial o virtual, en el horario que mejor les acomode.

¿Estarían interesados en coordinar esta actividad para su comunidad escolar?

Quedo a su disposición para cualquier consulta.

Atentamente,
Equipo Bioalergia
San Martín 870 Of. 208B, Concepción
+56 41 335 5293 | contacto@bioalergia.cl`,
  cuerpoHtml: `<p>Estimado/a <strong>{{nombre_director}}</strong>,</p>
<p>Me dirijo a usted en nombre de <strong>Bioalergia</strong>, centro especializado en alergología e inmunología clínica ubicado en Concepción.</p>
<p>Nos gustaría ofrecerle una charla educativa gratuita para padres, apoderados y/o personal docente de <strong>{{nombre_colegio}}</strong> sobre alergias respiratorias, alimentarias y el único tratamiento curativo disponible: la inmunoterapia alérgica.</p>
<p>La charla es completamente sin costo, tiene una duración de 45-60 minutos y puede realizarse de forma presencial o virtual, en el horario que mejor les acomode.</p>
<p>¿Estarían interesados en coordinar esta actividad para su comunidad escolar?</p>
<p>Quedo a su disposición para cualquier consulta.</p>
<p>Atentamente,<br/>
<strong>Equipo Bioalergia</strong><br/>
San Martín 870 Of. 208B, Concepción<br/>
+56 41 335 5293 | <a href="mailto:contacto@bioalergia.cl">contacto@bioalergia.cl</a></p>`,
};
