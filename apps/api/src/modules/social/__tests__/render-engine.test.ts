import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { renderSocialImage, SOCIAL_DIMENSIONS, SOCIAL_TEMPLATES } from "@finanzas/social-render";
import { describe, expect, it } from "vitest";

// Test de integración del motor de render (Satori → resvg). Sin mocks: usa las
// fuentes IBM Plex reales de assets/ y verifica que cada template/ratio produce
// un PNG válido. NO toca R2 (eso vive en render.ts, cubierto aparte).

const FONTS_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..", "assets", "fonts");
const fonts = [
  { name: "IBM Plex Sans", data: fs.readFileSync(path.join(FONTS_DIR, "IBMPlexSans-Regular.ttf")), weight: 400 as const },
  { name: "IBM Plex Sans", data: fs.readFileSync(path.join(FONTS_DIR, "IBMPlexSans-SemiBold.ttf")), weight: 600 as const },
];

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47]);

describe("renderSocialImage", () => {
  // Render nativo (Satori + resvg) es CPU-pesado y variable (sobre todo en CI /
  // bajo carga) → timeout generoso para evitar flakiness por tiempo.
  const RENDER_TIMEOUT = 45_000;

  it(
    "renderiza cada template en PNG válido",
    async () => {
      for (const template of SOCIAL_TEMPLATES) {
        const png = await renderSocialImage({
          template,
          props: { title: "Prueba", body: "Cuerpo", quote: "Frase", subtitle: "Sub", kicker: "K" },
          aspectRatio: "RATIO_1_1",
          fonts,
        });
        expect(png.length).toBeGreaterThan(1000);
        expect(png.subarray(0, 4)).toEqual(PNG_MAGIC);
      }
    },
    RENDER_TIMEOUT,
  );

  it(
    "respeta las dimensiones del aspect ratio",
    async () => {
      const png = await renderSocialImage({ template: "tip-card", props: { title: "X" }, aspectRatio: "RATIO_9_16", fonts });
      // IHDR width @ bytes 16..20 big-endian
      const width = png.readUInt32BE(16);
      const height = png.readUInt32BE(20);
      expect(width).toBe(SOCIAL_DIMENSIONS.RATIO_9_16.width);
      expect(height).toBe(SOCIAL_DIMENSIONS.RATIO_9_16.height);
    },
    RENDER_TIMEOUT,
  );

  it("lanza en template desconocido", async () => {
    await expect(renderSocialImage({ template: "nope", props: {}, aspectRatio: "RATIO_1_1", fonts })).rejects.toThrow();
  });
});
