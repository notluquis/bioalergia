// Generación OPCIONAL de imagen vía un modelo de IA (hero/fondo fotográfico).
// Pay-per-use; $0 si no se usa. El resultado es SIEMPRE un fondo decorativo: el
// TEXTO de marca NUNCA lo genera la IA — se compone encima con Satori (ver
// render.ts) para evitar typos/claims en una marca médica.
//
// Proveedores:
//   - GEMINI ("Nano Banana", gemini-2.5-flash-image): provider por defecto.
//     Free tier ~500 img/día; ~US$0.039/imagen 1024² fuera del free tier.
//   - RECRAFT (recraftv3): secundario. ~US$0.04/raster.
//
// Las keys viven en DB (Setting, encriptadas) — ver lib/social-settings.ts.

import { DomainError } from "../../lib/errors.ts";
import { logEvent } from "../../lib/logger.ts";
import { type AiImageProvider, getAiConfig } from "../../lib/social-settings.ts";

const GEMINI_MODEL = "gemini-2.5-flash-image";
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
const RECRAFT_ENDPOINT = "https://external.api.recraft.ai/v1/images/generations";

export interface GenerateAiImageInput {
  prompt: string;
  /** Override del provider configurado en DB. */
  provider?: AiImageProvider;
  /** Imagen de referencia (PNG/JPEG, p.ej. logo o foto de marca) para image-to-image. */
  referenceImage?: { mimeType: string; data: Buffer };
}

interface GeminiInlineData {
  mimeType?: string;
  data?: string;
}
interface GeminiPart {
  inlineData?: GeminiInlineData;
  text?: string;
}
interface GeminiResponse {
  candidates?: { content?: { parts?: GeminiPart[] } }[];
}

interface RecraftResponse {
  data?: { url?: string }[];
}

/**
 * Genera una imagen (PNG Buffer) con el modelo de IA configurado.
 * Lanza DomainError si no hay key configurada o si el modelo no devuelve imagen.
 */
export async function generateAiImage(input: GenerateAiImageInput): Promise<Buffer> {
  const prompt = input.prompt.trim();
  if (!prompt) {
    throw new DomainError("BAD_REQUEST", "El prompt de la imagen no puede estar vacío");
  }
  const config = await getAiConfig();
  const provider = input.provider ?? config.provider;

  if (provider === "RECRAFT") {
    return generateWithRecraft(prompt, config.recraftApiKey);
  }
  return generateWithGemini(prompt, config.geminiApiKey, input.referenceImage);
}

async function generateWithGemini(
  prompt: string,
  apiKey: string,
  referenceImage?: { mimeType: string; data: Buffer }
): Promise<Buffer> {
  if (!apiKey) {
    throw new DomainError(
      "BAD_REQUEST",
      "Falta la API key de Gemini. Configúrala en Redes → Configuración IA."
    );
  }
  const parts: GeminiPart[] = [{ text: prompt }];
  if (referenceImage) {
    parts.push({
      inlineData: {
        mimeType: referenceImage.mimeType,
        data: referenceImage.data.toString("base64"),
      },
    });
  }
  const res = await fetch(`${GEMINI_ENDPOINT}?key=${encodeURIComponent(apiKey)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contents: [{ parts }] }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new DomainError(
      "UNPROCESSABLE_ENTITY",
      `Gemini respondió ${res.status}: ${detail.slice(0, 300)}`
    );
  }
  const body = (await res.json()) as GeminiResponse;
  const imagePart = body.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data);
  const base64 = imagePart?.inlineData?.data;
  if (!base64) {
    throw new DomainError("UNPROCESSABLE_ENTITY", "Gemini no devolvió ninguna imagen");
  }
  const buf = Buffer.from(base64, "base64");
  logEvent("social.ai.image.generated", {
    provider: "GEMINI",
    bytes: buf.length,
    mimeType: imagePart?.inlineData?.mimeType ?? "image/png",
  });
  return buf;
}

async function generateWithRecraft(prompt: string, apiKey: string): Promise<Buffer> {
  if (!apiKey) {
    throw new DomainError(
      "BAD_REQUEST",
      "Falta la API key de Recraft. Configúrala en Redes → Configuración IA."
    );
  }
  const res = await fetch(RECRAFT_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      prompt,
      style: "realistic_image",
      size: "1024x1024",
      model: "recraftv3",
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new DomainError(
      "UNPROCESSABLE_ENTITY",
      `Recraft respondió ${res.status}: ${detail.slice(0, 300)}`
    );
  }
  const body = (await res.json()) as RecraftResponse;
  const url = body.data?.[0]?.url;
  if (!url) {
    throw new DomainError("UNPROCESSABLE_ENTITY", "Recraft no devolvió ninguna imagen");
  }
  const imgRes = await fetch(url);
  if (!imgRes.ok) {
    throw new DomainError(
      "UNPROCESSABLE_ENTITY",
      `No se pudo descargar la imagen de Recraft (${imgRes.status})`
    );
  }
  const buf = Buffer.from(await imgRes.arrayBuffer());
  logEvent("social.ai.image.generated", { provider: "RECRAFT", bytes: buf.length });
  return buf;
}
