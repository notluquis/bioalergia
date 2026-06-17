import { Resvg } from "@resvg/resvg-js";
import satori from "satori";

import { type SatoriNode } from "./h.ts";
import { type Dimensions, SOCIAL_TEMPLATES, templates } from "./templates.ts";

export { BRAND } from "./brand.ts";
export { SOCIAL_TEMPLATES } from "./templates.ts";

export type SocialAspectRatio = "RATIO_4_5" | "RATIO_1_1" | "RATIO_9_16";

// Tamaños sociales estándar (px).
export const SOCIAL_DIMENSIONS: Record<SocialAspectRatio, Dimensions> = {
  RATIO_4_5: { width: 1080, height: 1350 },
  RATIO_1_1: { width: 1080, height: 1080 },
  RATIO_9_16: { width: 1080, height: 1920 },
};

export interface SocialFont {
  name: string;
  data: ArrayBuffer | Buffer;
  weight?: 400 | 600 | 700;
  style?: "normal" | "italic";
}

export interface RenderSocialImageOptions {
  template: string;
  props: Record<string, unknown>;
  aspectRatio: SocialAspectRatio;
  fonts: SocialFont[];
}

/**
 * Renderiza un template de marca a PNG (Satori → SVG → resvg).
 * Determinístico; los colores/fuentes vienen de la marca (tokens en brand.ts +
 * IBM Plex pasada por el caller). El caller sube el Buffer a R2.
 */
export async function renderSocialImage(opts: RenderSocialImageOptions): Promise<Buffer> {
  const builder = templates[opts.template];
  if (!builder) {
    throw new Error(
      `Unknown social template "${opts.template}". Available: ${SOCIAL_TEMPLATES.join(", ")}`
    );
  }
  if (!opts.fonts || opts.fonts.length === 0) {
    throw new Error("renderSocialImage requires at least one font");
  }
  const dims = SOCIAL_DIMENSIONS[opts.aspectRatio];
  const node = builder(opts.props, dims) as SatoriNode;

  const svg = await satori(node as unknown as Parameters<typeof satori>[0], {
    width: dims.width,
    height: dims.height,
    fonts: opts.fonts.map((f) => ({
      name: f.name,
      data: f.data,
      weight: f.weight ?? 400,
      style: f.style ?? "normal",
    })),
  });

  const png = new Resvg(svg, { fitTo: { mode: "width", value: dims.width } }).render().asPng();
  return Buffer.from(png);
}
