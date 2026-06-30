import { describe, expect, it } from "vitest";
import { renderTemplateBody, renderTemplatePreview } from "../render-template.ts";

const ABONO_TEMPLATE = [
  { type: "HEADER", format: "TEXT", text: "Bioalergia · Dr. José Manuel Martínez" },
  {
    type: "BODY",
    text: "Hola {{nombre_paciente}} 👋 tu cita es el {{fecha_hora}} en {{direccion}}. FONASA {{fonasa_total}} / Particular {{particular_total}}.",
  },
  { type: "BUTTONS", buttons: [{ type: "URL", text: "Pagar", url: "https://x/abono/{{1}}" }] },
];

const SENT_NAMED = [
  {
    type: "body",
    parameters: [
      { type: "text", parameter_name: "nombre_paciente", text: "EMILIANO PALMA" },
      { type: "text", parameter_name: "fecha_hora", text: "Miércoles 1 de julio a las 11:45" },
      { type: "text", parameter_name: "direccion", text: "Av. Prat 199" },
      { type: "text", parameter_name: "fonasa_total", text: "$50.000" },
      { type: "text", parameter_name: "particular_total", text: "$60.000" },
    ],
  },
];

describe("renderTemplateBody", () => {
  it("substitutes named params and prefixes the text header", () => {
    const out = renderTemplateBody(ABONO_TEMPLATE, SENT_NAMED);
    expect(out).toBe(
      "Bioalergia · Dr. José Manuel Martínez\n\n" +
        "Hola EMILIANO PALMA 👋 tu cita es el Miércoles 1 de julio a las 11:45 en Av. Prat 199. FONASA $50.000 / Particular $60.000."
    );
    expect(out).not.toContain("{{");
  });

  it("substitutes positional params ({{1}})", () => {
    const tpl = [{ type: "BODY", text: "Código: {{1}} — vence {{2}}" }];
    const sent = [{ type: "body", parameters: [{ text: "ABC" }, { text: "mañana" }] }];
    expect(renderTemplateBody(tpl, sent)).toBe("Código: ABC — vence mañana");
  });

  it("returns null when there is no text body (media-only template)", () => {
    const tpl = [{ type: "HEADER", format: "IMAGE" }, { type: "BUTTONS", buttons: [] }];
    expect(renderTemplateBody(tpl, [])).toBeNull();
  });

  it("collapses newlines for the list preview", () => {
    const tpl = [{ type: "BODY", text: "linea1\n\nlinea2 {{1}}" }];
    const sent = [{ type: "body", parameters: [{ text: "x" }] }];
    expect(renderTemplatePreview(tpl, sent)).toBe("linea1 linea2 x");
  });

  it("substitutes dynamic text header params ({{1}}) before prefixing", () => {
    const tpl = [
      { type: "HEADER", format: "TEXT", text: "Pedido {{1}}" },
      { type: "BODY", text: "Hola {{1}}" },
    ];
    const sent = [
      { type: "header", parameters: [{ text: "#A-42" }] },
      { type: "body", parameters: [{ text: "Ana" }] },
    ];
    expect(renderTemplateBody(tpl, sent)).toBe("Pedido #A-42\n\nHola Ana");
  });

  it("tolerates missing params (leaves nothing rendered, no crash)", () => {
    const tpl = [{ type: "BODY", text: "Hola {{nombre}}" }];
    expect(renderTemplateBody(tpl, [])).toBe("Hola {{nombre}}");
  });
});
