// Render the human-readable text of a sent WhatsApp template message, so the
// inbox shows the ACTUAL message (with the patient name, dates, prices, …)
// instead of just the template name. Meta never echoes our own sends, so we
// reconstruct the text at send time from two pieces we already have:
//   - the template definition (WaTemplate.components) — body text with
//     {{placeholders}} ("Hola {{nombre}}, tu cita es {{fecha_hora}}…")
//   - the sent components (the param values we passed to Meta)
// The same function backfills historical TEMPLATE messages from their stored
// payload.components.

type MetaParam = {
  type?: string;
  text?: string;
  parameter_name?: string;
  coupon_code?: string;
};
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
type TemplateButton = {
  type?: string;
  text?: string;
  url?: string;
  phone_number?: string;
};

function findButtons(templateComponents: unknown): TemplateButton[] {
  if (!Array.isArray(templateComponents)) return [];
  for (const c of templateComponents) {
    if (isObject(c) && typeof c.type === "string" && c.type.toUpperCase() === "BUTTONS") {
      const btns = (c as { buttons?: unknown }).buttons;
      return Array.isArray(btns) ? (btns as TemplateButton[]) : [];
    }
  }
  return [];
}

// The sent `button` components carry per-button dynamic values (e.g. a URL
// button's {{1}} suffix), keyed by their `index`. Returns the first text param.
function sentButtonParam(sentComponents: unknown, index: number): string | null {
  if (!Array.isArray(sentComponents)) return null;
  for (const c of sentComponents) {
    if (!isObject(c) || typeof c.type !== "string" || c.type.toLowerCase() !== "button") continue;
    if (Number((c as { index?: unknown }).index ?? 0) !== index) continue;
    const params = (c as { parameters?: MetaParam[] }).parameters;
    const p = Array.isArray(params) ? params[0] : undefined;
    // URL buttons send the value as `text`; COPY_CODE buttons as `coupon_code`.
    const value = p?.text ?? p?.coupon_code;
    return typeof value === "string" ? value : null;
  }
  return null;
}

// Render the template's action buttons as readable lines so the inbox shows them
// (WhatsApp displays them as tappable; our internal inbox lists them). Resolves a
// URL button's {{1}} from the sent param so the operator sees the real link.
function renderButtons(templateComponents: unknown, sentComponents: unknown): string | null {
  const buttons = findButtons(templateComponents);
  if (buttons.length === 0) return null;
  const lines = buttons
    .map((b, i) => {
      const label = (b.text ?? "").trim();
      switch ((b.type ?? "").toUpperCase()) {
        case "URL": {
          const url = (b.url ?? "").replace("{{1}}", sentButtonParam(sentComponents, i) ?? "");
          return `🔗 ${label || "Enlace"}: ${url}`.trim();
        }
        case "PHONE_NUMBER":
          return `📞 ${label || "Llamar"}: ${b.phone_number ?? ""}`.trim();
        case "COPY_CODE": {
          const code = sentButtonParam(sentComponents, i);
          return `📋 ${label || "Copiar código"}${code ? `: ${code}` : ""}`;
        }
        case "QUICK_REPLY":
          return label ? `↩️ ${label}` : "";
        case "FLOW":
          return `📝 ${label || "Abrir formulario"}`;
        default:
          return label ? `• ${label}` : "";
      }
    })
    .filter((l) => l.trim());
  return lines.length > 0 ? lines.join("\n") : null;
}

// Header + body only (params substituted) — shared by the full render and the
// one-line preview.
function renderHeaderBody(templateComponents: unknown, sentComponents: unknown): string | null {
  const bodyText = findBodyText(templateComponents);
  if (bodyText === null) return null;
  const rendered = substitute(bodyText, componentParams(sentComponents, "body"));
  // The text header (e.g. "Bioalergia · Dr. …") can itself be dynamic ({{1}}) —
  // substitute its params too, else it would persist as "Hola {{1}}".
  const headerText = findHeaderText(templateComponents);
  if (!headerText) return rendered;
  return `${substitute(headerText, componentParams(sentComponents, "header"))}\n\n${rendered}`;
}

export function renderTemplateBody(
  templateComponents: unknown,
  sentComponents: unknown
): string | null {
  const text = renderHeaderBody(templateComponents, sentComponents);
  if (text === null) return null;
  const buttons = renderButtons(templateComponents, sentComponents);
  return buttons ? `${text}\n\n${buttons}` : text;
}

/** One-line preview for the conversation list (body only, no buttons). */
export function renderTemplatePreview(
  templateComponents: unknown,
  sentComponents: unknown
): string | null {
  const text = renderHeaderBody(templateComponents, sentComponents);
  if (text === null) return null;
  return text.replace(/\s*\n\s*/g, " ").trim().slice(0, 200);
}
