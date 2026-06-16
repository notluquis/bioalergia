import { BRAND } from "./brand.ts";
import { h, type SatoriNode } from "./h.ts";

export interface Dimensions {
  width: number;
  height: number;
}

type Props = Record<string, unknown>;

function str(v: unknown, fallback = ""): string {
  return typeof v === "string" && v.length > 0 ? v : fallback;
}

function root(dims: Dimensions, bg: string, children: SatoriNode[]): SatoriNode {
  return h(
    "div",
    {
      style: {
        display: "flex",
        flexDirection: "column",
        width: `${dims.width}px`,
        height: `${dims.height}px`,
        backgroundColor: bg,
        padding: "96px",
        fontFamily: BRAND.fontFamily,
        position: "relative",
      },
    },
    ...children,
  );
}

function brandFooter(): SatoriNode {
  return h(
    "div",
    {
      style: {
        display: "flex",
        alignItems: "center",
        marginTop: "auto",
        fontSize: "34px",
        fontWeight: 600,
        color: BRAND.blue,
      },
    },
    h("div", { style: { display: "flex", width: "44px", height: "44px", borderRadius: "12px", backgroundColor: BRAND.amber, marginRight: "20px" } }),
    "Bioalergia",
  );
}

// quote-card: frase grande centrada + footer de marca
function quoteCard(props: Props, dims: Dimensions): SatoriNode {
  return root(dims, BRAND.cream, [
    h("div", { style: { display: "flex", fontSize: "120px", fontWeight: 700, color: BRAND.amber, lineHeight: 0.8 } }, "“"),
    h(
      "div",
      { style: { display: "flex", flexGrow: 1, alignItems: "center", fontSize: "64px", fontWeight: 600, color: BRAND.ink, lineHeight: 1.25 } },
      str(props.quote, "Tu salud respiratoria importa."),
    ),
    str(props.author)
      ? h("div", { style: { display: "flex", fontSize: "34px", color: BRAND.blue, marginBottom: "24px" } }, str(props.author))
      : null,
    brandFooter(),
  ].filter(Boolean) as SatoriNode[]);
}

// tip-card: barra de acento + título + cuerpo
function tipCard(props: Props, dims: Dimensions): SatoriNode {
  return root(dims, BRAND.white, [
    h("div", { style: { display: "flex", width: "120px", height: "14px", borderRadius: "8px", backgroundColor: BRAND.amber, marginBottom: "48px" } }),
    h("div", { style: { display: "flex", fontSize: "30px", fontWeight: 600, letterSpacing: "4px", color: BRAND.blue, marginBottom: "24px" } }, str(props.kicker, "CONSEJO")),
    h("div", { style: { display: "flex", fontSize: "72px", fontWeight: 700, color: BRAND.ink, lineHeight: 1.1, marginBottom: "36px" } }, str(props.title, "Título")),
    h("div", { style: { display: "flex", fontSize: "42px", color: BRAND.ink, lineHeight: 1.4, opacity: 0.85 } }, str(props.body, "")),
    brandFooter(),
  ]);
}

// announcement: bloque de color con titular + subtítulo
function announcement(props: Props, dims: Dimensions): SatoriNode {
  return root(dims, BRAND.blue, [
    h("div", { style: { display: "flex", fontSize: "30px", fontWeight: 600, letterSpacing: "4px", color: BRAND.amber, marginBottom: "32px" } }, str(props.kicker, "BIOALERGIA")),
    h("div", { style: { display: "flex", flexGrow: 1, alignItems: "center", fontSize: "92px", fontWeight: 700, color: BRAND.white, lineHeight: 1.05 } }, str(props.title, "Anuncio")),
    str(props.subtitle)
      ? h("div", { style: { display: "flex", fontSize: "44px", color: BRAND.mist, lineHeight: 1.3 } }, str(props.subtitle))
      : null,
  ].filter(Boolean) as SatoriNode[]);
}

export const templates: Record<string, (props: Props, dims: Dimensions) => SatoriNode> = {
  "quote-card": quoteCard,
  "tip-card": tipCard,
  announcement,
};

export const SOCIAL_TEMPLATES = Object.keys(templates);
