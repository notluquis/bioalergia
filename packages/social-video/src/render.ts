// Programmatic Remotion render — runs LOCALLY on the Mac (NEVER on Railway:
// video encode is CPU-heavy and Railway bills CPU). bundle() spins up Remotion's
// own webpack to compile the .tsx compositions (Node can't JSX-transform them),
// so this file stays plain TS and is consumable by apps/api via Node 26
// type-stripping. The caller uploads the resulting MP4 to R2.
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";

// `type` (not interface) so it satisfies the Record<string, unknown> that
// Remotion's selectComposition/renderMedia inputProps expect.
export type ReelRenderProps = {
  kicker: string;
  title: string;
  bullets: string[];
  cta: string;
};

export interface RenderReelResult {
  path: string;
  durationMs: number;
  width: number;
  height: number;
}

// Remotion's webpack reads the .tsx compositions from src/. When this file runs
// as compiled dist/render.mjs the source is at ../src/Root.tsx; when run as
// src/render.ts (tests/studio) it's a sibling ./Root.tsx.
const HERE = path.dirname(fileURLToPath(import.meta.url));
const ENTRY = (() => {
  const sibling = path.resolve(HERE, "Root.tsx"); // running from src/
  if (existsSync(sibling)) return sibling;
  return path.resolve(HERE, "..", "src", "Root.tsx"); // running from dist/
})();

/**
 * Renderiza un reel 9:16 branded a MP4 (h264) en `outPath`. Local-only.
 * Devuelve la ruta + duración en ms (para el media item del SocialPost).
 */
export async function renderReel(
  props: ReelRenderProps,
  outPath: string
): Promise<RenderReelResult> {
  const serveUrl = await bundle({
    entryPoint: ENTRY,
    webpackOverride: (config) => config,
  });

  const composition = await selectComposition({
    serveUrl,
    id: "reel",
    inputProps: props,
  });

  await renderMedia({
    composition,
    serveUrl,
    codec: "h264",
    outputLocation: outPath,
    inputProps: props,
  });

  const durationMs = Math.round((composition.durationInFrames / composition.fps) * 1000);
  return {
    path: outPath,
    durationMs,
    width: composition.width,
    height: composition.height,
  };
}
