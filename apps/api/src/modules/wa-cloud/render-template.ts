// Render the human-readable text of a sent WhatsApp template message, so the
// inbox shows the ACTUAL message (with the patient name, dates, prices, …)
// instead of just the template name. Meta never echoes our own sends, so we
// reconstruct the text at send time from two pieces we already have:
//   - the template definition (WaTemplate.components) — body text with
//     {{placeholders}} ("Hola {{nombre}}, tu cita es {{fecha_hora}}…")
//   - the sent components (the param values we passed to Meta)
// The same function backfills historical TEMPLATE messages from their stored
// payload.components.

type MetaParam = { type?: string; text?: string; parameter_name?: string };
type SentComponent = { type?: string; parameters?: MetaParam[] };

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function findBodyText(templateComponents: unknown): string | null {
  if (!Array.isArray(templateComponents)) return null;
  for (const c of templateComponents) {
    if (isObject(c) && typeof c.type === "string" && c.type.toUpperCase() === "BODY") {
      return typeof c.text === "string" ? c.text : null;
    }
  }
  return null;
}

function findHeaderText(templateComponents: unknown): string | null {
  if (!Array.isArray(templateComponents)) return null;
  for (const c of templateComponents) {
    if (!isObject(c)) continue;
    const type = typeof c.type === "string" ? c.type.toUpperCase() : "";
    const format = typeof c.format === "string" ? c.format.toUpperCase() : "";
    if (type === "HEADER" && format === "TEXT") {
      return typeof c.text === "string" ? c.text : null;
    }
  }
  return null;
}

function componentParams(sentComponents: unknown, kind: "body" | "header"): MetaParam[] {
  if (!Array.isArray(sentComponents)) return [];
  for (const c of sentComponents) {
    if (isObject(c) && typeof c.type === "string" && c.type.toLowerCase() === kind) {
      const params = (c as SentComponent).parameters;
      return Array.isArray(params) ? params : [];
    }
  }
  return [];
}

function substitute(text: string, params: MetaParam[]): string {
  let out = text;
  params.forEach((p, i) => {
    const value = typeof p.text === "string" ? p.text : "";
    // Named templates carry parameter_name ({{nombre_paciente}}); positional
    // ones don't ({{1}}, {{2}}…). Replace whichever this param targets.
    const placeholder = p.parameter_name ? `{{${p.parameter_name}}}` : `{{${i + 1}}}`;
    out = out.split(placeholder).join(value);
  });
  return out;
}

/**
 * Render the body text of a sent template: substitute {{named}} / {{1}}
 * placeholders with the values that were actually sent. Returns null when the
 * template has no text body to render (e.g. media-only templates) so the caller
 * can fall back to the template name.
 */
export function renderTemplateBody(
  templateComponents: unknown,
  sentComponents: unknown
): string | null {
  const bodyText = findBodyText(templateComponents);
  if (bodyText === null) return null;

  const rendered = substitute(bodyText, componentParams(sentComponents, "body"));

  // Prefix the text header (e.g. "Bioalergia · Dr. …") when present, so the
  // bubble reads like the real WhatsApp message. The header can itself be a
  // dynamic text header ({{1}}) — substitute its params too, else it would
  // persist as "Hola {{1}}".
  const headerText = findHeaderText(templateComponents);
  if (!headerText) return rendered;
  const renderedHeader = substitute(headerText, componentParams(sentComponents, "header"));
  return `${renderedHeader}\n\n${rendered}`;
}

/** One-line preview for the conversation list (newlines collapsed, trimmed). */
export function renderTemplatePreview(
  templateComponents: unknown,
  sentComponents: unknown
): string | null {
  const full = renderTemplateBody(templateComponents, sentComponents);
  if (full === null) return null;
  return full.replace(/\s*\n\s*/g, " ").trim().slice(0, 200);
}
