// Render de contenido social: Satori (JSX→SVG) + resvg (SVG→PNG) vía
// @finanzas/social-render, con IBM Plex (reusa las fuentes de assets/) y subida
// a R2 (URL pública, requerida por Meta/TikTok). Determinístico y $0.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  renderSocialImage,
  SOCIAL_DIMENSIONS,
  type SocialAspectRatio,
  type SocialFont,
} from "@finanzas/social-render";

import { putR2Object } from "../cloudflare/r2.ts";

const FONTS_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "assets", "fonts");

let fontsCache: SocialFont[] | null = null;

function loadFonts(): SocialFont[] {
  if (fontsCache) return fontsCache;
  const regular = fs.readFileSync(path.join(FONTS_DIR, "IBMPlexSans-Regular.ttf"));
  const semibold = fs.readFileSync(path.join(FONTS_DIR, "IBMPlexSans-SemiBold.ttf"));
  fontsCache = [
    { name: "IBM Plex Sans", data: regular, weight: 400 },
    { name: "IBM Plex Sans", data: semibold, weight: 600 },
    { name: "IBM Plex Sans", data: semibold, weight: 700 },
  ];
  return fontsCache;
}

export interface RenderedMedia {
  key: string;
  url: string;
  type: "image";
  width: number;
  height: number;
}

export async function renderAndUploadSocialImage(args: {
  postId: number;
  template: string;
  props: Record<string, unknown>;
  aspectRatio: SocialAspectRatio;
}): Promise<RenderedMedia> {
  const png = await renderSocialImage({
    template: args.template,
    props: args.props,
    aspectRatio: args.aspectRatio,
    fonts: loadFonts(),
  });
  const dims = SOCIAL_DIMENSIONS[args.aspectRatio];
  const stamp = Date.now();
  const key = `social/${args.postId}/${args.template}-${args.aspectRatio}-${stamp}.png`;
  const url = await putR2Object(key, png, "image/png");
  return { key, url, type: "image", width: dims.width, height: dims.height };
}
