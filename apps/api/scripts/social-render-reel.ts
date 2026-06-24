// Render LOCAL de un reel (video 9:16) + draft SocialPost. Lo invoca el comando
// /social-reel de Claude Code. CORRE EN EL MAC, no en Railway: Remotion (webpack
// + Chromium headless + encode h264) es pesado en CPU y Railway cobra CPU.
// @finanzas/social-video es devDependency de apps/api → el runtime de Railway
// (app.ts) NUNCA importa Remotion; `pnpm install --prod` no lo trae.
//
// Flujo: renderReel → MP4 en /tmp → putR2Object (R2, URL pública) →
// createSocialPost (VIDEO / 9:16 / targets reel) con el media item apuntando a R2.
// El api en Railway solo publica desde la URL de R2.
//
// Uso:
//   node --env-file=apps/api/.env apps/api/scripts/social-render-reel.ts '<json>'
//   echo '<json>' | node --env-file=apps/api/.env apps/api/scripts/social-render-reel.ts
//
// JSON: { title, kicker, bullets: string[], cta, caption?, hashtags?: string[],
//         scheduledAt? }

import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";

const __dirname = dirname(fileURLToPath(import.meta.url));
// scripts/ → ../.env (apps/api/.env), ../../../packages/db/.env
config({ path: resolve(__dirname, "../.env") });
config({ path: resolve(__dirname, "../../../packages/db/.env") });

interface ReelInput {
  title: string;
  kicker: string;
  bullets: string[];
  cta: string;
  caption?: string;
  hashtags?: string[];
  scheduledAt?: string;
}

function assertReelInput(value: unknown): asserts value is ReelInput {
  if (typeof value !== "object" || value === null) throw new Error("JSON inválido");
  const v = value as Record<string, unknown>;
  if (typeof v.title !== "string" || !v.title.trim()) throw new Error("title requerido");
  if (typeof v.kicker !== "string" || !v.kicker.trim()) throw new Error("kicker requerido");
  if (typeof v.cta !== "string" || !v.cta.trim()) throw new Error("cta requerido");
  if (
    !Array.isArray(v.bullets) ||
    v.bullets.length < 2 ||
    v.bullets.length > 3 ||
    !v.bullets.every((b) => typeof b === "string" && b.trim())
  ) {
    throw new Error("bullets debe ser un array de 2-3 strings no vacíos");
  }
}

async function readInput(): Promise<ReelInput> {
  const arg = process.argv[2];
  let raw: unknown;
  if (arg) {
    raw = JSON.parse(arg);
  } else {
    const chunks: Buffer[] = [];
    for await (const c of process.stdin) chunks.push(c as Buffer);
    const text = Buffer.concat(chunks).toString("utf8").trim();
    if (!text) throw new Error("Sin input JSON (pasalo como arg o por stdin)");
    raw = JSON.parse(text);
  }
  assertReelInput(raw);
  return raw;
}

async function main() {
  const input = await readInput();

  // Imports dinámicos: el render (Remotion) y el DB layer se cargan en runtime.
  // social-video se importa por RUTA RELATIVA al dist del paquete (NO por nombre):
  // así NO es dependencia de apps/api → Remotion (rspack/webpack) queda fuera del
  // grafo de `turbo prune` del deploy de Railway (antes rompía el lockfile pruned:
  // "no entry for css-loader@7.1.4(@rspack...)"). Este script SOLO corre en el Mac.
  // Requiere `pnpm -F @finanzas/social-video build` antes (el comando /social-reel
  // lo hace). dist/render.mjs trae el JSX transpilado (Node no strippea .tsx).
  const reelModuleUrl = new URL(
    "../../../packages/social-video/dist/render.mjs",
    import.meta.url
  );
  // Tipado local de renderReel (no se importa el tipo del paquete porque ya no es
  // dependencia de apps/api; el .d.mts vive en dist gitignored, ausente en CI).
  type RenderReel = (
    props: { kicker: string; title: string; bullets: string[]; cta: string },
    outPath: string
  ) => Promise<{ path: string; width: number; height: number; durationMs: number }>;
  const { renderReel } = (await import(reelModuleUrl.href)) as { renderReel: RenderReel };
  const { db } = await import("@finanzas/db");
  const { createSocialPost } = await import("../src/services/social.ts");
  const { putR2Object } = await import("../src/modules/cloudflare/r2.ts");

  const user = await db.user.findFirst({ orderBy: { id: "asc" }, select: { id: true } });
  if (!user) throw new Error("No hay usuarios en la DB");

  let account = await db.socialAccount.findFirst({ orderBy: { id: "asc" } });
  if (!account) {
    account = await db.socialAccount.create({
      data: { provider: "META", displayName: "Bioalergia (placeholder Fase A)" },
    });
    console.log(`ℹ️  SocialAccount placeholder creada (id=${account.id})`);
  }
  const accountId = account.id;

  // 1) Render LOCAL → MP4 en /tmp
  const outPath = join(tmpdir(), `bioalergia-reel-${Date.now()}.mp4`);
  console.log(`🎬 Renderizando reel localmente → ${outPath} ...`);
  const rendered = await renderReel(
    { kicker: input.kicker, title: input.title, bullets: input.bullets, cta: input.cta },
    outPath
  );

  // 2) Subir a R2 (URL pública, requerida por Meta para publicar)
  const { readFile } = await import("node:fs/promises");
  const mp4 = await readFile(rendered.path);
  const key = `social/reels/${Date.now()}.mp4`;
  console.log(`☁️  Subiendo a R2 (${(mp4.length / 1024 / 1024).toFixed(2)} MB) ...`);
  const mediaUrl = await putR2Object(key, mp4, "video/mp4");

  // 3) Crear draft SocialPost (VIDEO / 9:16 / targets reel)
  const targets = [
    { accountId, network: "INSTAGRAM" as const, placement: "IG_REEL" as const },
    { accountId, network: "FACEBOOK" as const, placement: "FB_REEL" as const },
  ];

  const post = await createSocialPost(
    {
      title: input.title,
      caption: input.caption,
      hashtags: input.hashtags ?? [],
      mediaType: "VIDEO",
      aspectRatio: "RATIO_9_16",
      media: [
        {
          key,
          url: mediaUrl,
          type: "video",
          width: rendered.width,
          height: rendered.height,
          durationMs: rendered.durationMs,
        },
      ],
      targets,
      scheduledAt: input.scheduledAt,
    },
    user.id
  );

  console.log(
    JSON.stringify(
      {
        ok: true,
        postId: post.id,
        status: post.status,
        mediaUrl,
        durationMs: rendered.durationMs,
        localFile: rendered.path,
      },
      null,
      2
    )
  );
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
