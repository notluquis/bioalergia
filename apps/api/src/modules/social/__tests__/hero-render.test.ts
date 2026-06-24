import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { renderSocialImage, SOCIAL_DIMENSIONS } from "@finanzas/social-render";
import { describe, expect, it } from "vitest";

// Smoke del template "hero": fondo (data URI dummy) + scrim + texto de marca.
// El texto se compone con Satori (NUNCA por IA). Verifica que produce un PNG
// válido con las dimensiones del aspect ratio. Usa las fuentes reales de assets/.

const FONTS_DIR = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "..",
  "..",
  "assets",
  "fonts"
);
const fonts = [
  {
    name: "IBM Plex Sans",
    data: fs.readFileSync(path.join(FONTS_DIR, "IBMPlexSans-Regular.ttf")),
    weight: 400 as const,
  },
  {
    name: "IBM Plex Sans",
    data: fs.readFileSync(path.join(FONTS_DIR, "IBMPlexSans-SemiBold.ttf")),
    weight: 600 as const,
  },
];

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47]);

// 1x1 PNG transparente (base64) — fondo dummy mínimo para Satori <img src=...>.
const DUMMY_PNG_DATA_URI =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

describe("hero template", () => {
  const RENDER_TIMEOUT = 45_000;

  it(
    "renderiza fondo + texto de marca a PNG válido con las dims del ratio",
    async () => {
      const png = await renderSocialImage({
        template: "hero",
        props: {
          backgroundDataUri: DUMMY_PNG_DATA_URI,
          kicker: "BIOALERGIA",
          title: "Respira mejor esta primavera",
          cta: "Agenda tu hora",
        },
        aspectRatio: "RATIO_4_5",
        fonts,
      });
      expect(png.length).toBeGreaterThan(1000);
      expect(png.subarray(0, 4)).toEqual(PNG_MAGIC);
      expect(png.readUInt32BE(16)).toBe(SOCIAL_DIMENSIONS.RATIO_4_5.width);
      expect(png.readUInt32BE(20)).toBe(SOCIAL_DIMENSIONS.RATIO_4_5.height);
    },
    RENDER_TIMEOUT
  );

  it(
    "sin backgroundDataUri cae a fondo sólido (sigue siendo PNG válido)",
    async () => {
      const png = await renderSocialImage({
        template: "hero",
        props: { title: "Bioalergia" },
        aspectRatio: "RATIO_1_1",
        fonts,
      });
      expect(png.subarray(0, 4)).toEqual(PNG_MAGIC);
    },
    RENDER_TIMEOUT
  );
});
