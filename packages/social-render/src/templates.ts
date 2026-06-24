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
    ...children
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
    h("div", {
      style: {
        display: "flex",
        width: "44px",
        height: "44px",
        borderRadius: "12px",
        backgroundColor: BRAND.amber,
        marginRight: "20px",
      },
    }),
    "Bioalergia"
  );
}

// quote-card: frase grande centrada + footer de marca
function quoteCard(props: Props, dims: Dimensions): SatoriNode {
  return root(
    dims,
    BRAND.cream,
    [
      h(
        "div",
        {
          style: {
            display: "flex",
            fontSize: "120px",
            fontWeight: 700,
            color: BRAND.amber,
            lineHeight: 0.8,
          },
        },
        "“"
      ),
      h(
        "div",
        {
          style: {
            display: "flex",
            flexGrow: 1,
            alignItems: "center",
            fontSize: "64px",
            fontWeight: 600,
            color: BRAND.ink,
            lineHeight: 1.25,
          },
        },
        str(props.quote, "Tu salud respiratoria importa.")
      ),
      str(props.author)
        ? h(
            "div",
            {
              style: { display: "flex", fontSize: "34px", color: BRAND.blue, marginBottom: "24px" },
            },
            str(props.author)
          )
        : null,
      brandFooter(),
    ].filter(Boolean) as SatoriNode[]
  );
}

// tip-card: barra de acento + título + cuerpo
function tipCard(props: Props, dims: Dimensions): SatoriNode {
  return root(dims, BRAND.white, [
    h("div", {
      style: {
        display: "flex",
        width: "120px",
        height: "14px",
        borderRadius: "8px",
        backgroundColor: BRAND.amber,
        marginBottom: "48px",
      },
    }),
    h(
      "div",
      {
        style: {
          display: "flex",
          fontSize: "30px",
          fontWeight: 600,
          letterSpacing: "4px",
          color: BRAND.blue,
          marginBottom: "24px",
        },
      },
      str(props.kicker, "CONSEJO")
    ),
    h(
      "div",
      {
        style: {
          display: "flex",
          fontSize: "72px",
          fontWeight: 700,
          color: BRAND.ink,
          lineHeight: 1.1,
          marginBottom: "36px",
        },
      },
      str(props.title, "Título")
    ),
    h(
      "div",
      {
        style: {
          display: "flex",
          fontSize: "42px",
          color: BRAND.ink,
          lineHeight: 1.4,
          opacity: 0.85,
        },
      },
      str(props.body, "")
    ),
    brandFooter(),
  ]);
}

// announcement: bloque de color con titular + subtítulo
function announcement(props: Props, dims: Dimensions): SatoriNode {
  return root(
    dims,
    BRAND.blue,
    [
      h(
        "div",
        {
          style: {
            display: "flex",
            fontSize: "30px",
            fontWeight: 600,
            letterSpacing: "4px",
            color: BRAND.amber,
            marginBottom: "32px",
          },
        },
        str(props.kicker, "BIOALERGIA")
      ),
      h(
        "div",
        {
          style: {
            display: "flex",
            flexGrow: 1,
            alignItems: "center",
            fontSize: "92px",
            fontWeight: 700,
            color: BRAND.white,
            lineHeight: 1.05,
          },
        },
        str(props.title, "Anuncio")
      ),
      str(props.subtitle)
        ? h(
            "div",
            { style: { display: "flex", fontSize: "44px", color: BRAND.mist, lineHeight: 1.3 } },
            str(props.subtitle)
          )
        : null,
    ].filter(Boolean) as SatoriNode[]
  );
}

// hero: fondo full-bleed (imagen generada por IA, pasada como data URI) + scrim
// oscuro para legibilidad + texto de marca (kicker/title/cta) encima. El TEXTO
// NUNCA es generado por IA — solo el fondo lo es; el copy de marca se compone
// determinísticamente acá (evita typos/claims en una marca médica). Si no llega
// backgroundDataUri, cae a un fondo sólido de marca (sigue siendo válido).
function hero(props: Props, dims: Dimensions): SatoriNode {
  const bg = str(props.backgroundDataUri);
  const layers: SatoriNode[] = [];

  if (bg) {
    layers.push(
      h("img", {
        src: bg,
        width: dims.width,
        height: dims.height,
        style: {
          position: "absolute",
          top: "0px",
          left: "0px",
          width: `${dims.width}px`,
          height: `${dims.height}px`,
          objectFit: "cover",
        },
      })
    );
  }

  // Scrim: degradado oscuro de abajo hacia arriba para que el texto siempre
  // tenga contraste, independiente de la imagen de fondo.
  layers.push(
    h("div", {
      style: {
        display: "flex",
        position: "absolute",
        top: "0px",
        left: "0px",
        width: `${dims.width}px`,
        height: `${dims.height}px`,
        backgroundImage:
          "linear-gradient(180deg, rgba(15,28,38,0.15) 0%, rgba(15,28,38,0.35) 45%, rgba(15,28,38,0.85) 100%)",
      },
    })
  );

  const content: SatoriNode[] = [
    h("div", {
      style: {
        display: "flex",
        width: "120px",
        height: "14px",
        borderRadius: "8px",
        backgroundColor: BRAND.amber,
        marginBottom: "36px",
      },
    }),
    str(props.kicker)
      ? h(
          "div",
          {
            style: {
              display: "flex",
              fontSize: "30px",
              fontWeight: 600,
              letterSpacing: "4px",
              color: BRAND.amber,
              marginBottom: "20px",
            },
          },
          str(props.kicker)
        )
      : null,
    h(
      "div",
      {
        style: {
          display: "flex",
          fontSize: "84px",
          fontWeight: 700,
          color: BRAND.white,
          lineHeight: 1.05,
        },
      },
      str(props.title, "Bioalergia")
    ),
    str(props.cta)
      ? h(
          "div",
          {
            style: {
              display: "flex",
              alignSelf: "flex-start",
              marginTop: "40px",
              padding: "20px 40px",
              borderRadius: "999px",
              backgroundColor: BRAND.amber,
              color: BRAND.ink,
              fontSize: "38px",
              fontWeight: 600,
            },
          },
          str(props.cta)
        )
      : null,
  ].filter(Boolean) as SatoriNode[];

  // Contenedor del texto, anclado al fondo (justifyContent flex-end).
  layers.push(
    h(
      "div",
      {
        style: {
          display: "flex",
          flexDirection: "column",
          position: "relative",
          width: "100%",
          height: "100%",
          justifyContent: "flex-end",
        },
      },
      ...content
    )
  );

  return root(dims, BRAND.ink, layers);
}

export const templates: Record<string, (props: Props, dims: Dimensions) => SatoriNode> = {
  "quote-card": quoteCard,
  "tip-card": tipCard,
  announcement,
  hero,
};

export const SOCIAL_TEMPLATES = Object.keys(templates);
