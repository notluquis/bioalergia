// Helper de generación (lo invoca el comando /social-batch de Claude Code).
// Crea un SocialPost en DRAFT + renderiza la imagen (Satori→R2). Claude escribe
// el copy/props; este script persiste. Fase A: usa una SocialAccount placeholder
// si no hay ninguna conectada (los targets necesitan accountId).
//
// Uso:
//   node --env-file=apps/api/.env apps/api/src/scripts/social-create-draft.ts '<json>'
//   echo '<json>' | node --env-file=apps/api/.env apps/api/src/scripts/social-create-draft.ts
//
// JSON: { title?, caption?, hashtags?, mediaType?, aspectRatio?, template?, props?,
//         targets?: [{ accountId?, network, placement }], scheduledAt? }

import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, "../../.env") });
config({ path: resolve(__dirname, "../../../../packages/db/.env") });

type AspectRatio = "RATIO_4_5" | "RATIO_1_1" | "RATIO_9_16";
type Network = "INSTAGRAM" | "FACEBOOK" | "TIKTOK";
type Placement =
  | "IG_FEED"
  | "IG_REEL"
  | "IG_STORY"
  | "FB_FEED"
  | "FB_REEL"
  | "FB_STORY"
  | "TIKTOK_VIDEO";

interface DraftInput {
  title?: string;
  caption?: string;
  hashtags?: string[];
  mediaType?: "IMAGE" | "VIDEO" | "CAROUSEL";
  aspectRatio?: AspectRatio;
  template?: string;
  props?: Record<string, unknown>;
  targets?: { accountId?: number; network: Network; placement: Placement }[];
  scheduledAt?: string;
}

async function readInput(): Promise<DraftInput> {
  const arg = process.argv[2];
  if (arg) return JSON.parse(arg) as DraftInput;
  const chunks: Buffer[] = [];
  for await (const c of process.stdin) chunks.push(c as Buffer);
  const text = Buffer.concat(chunks).toString("utf8").trim();
  if (!text) throw new Error("Sin input JSON (pasalo como arg o por stdin)");
  return JSON.parse(text) as DraftInput;
}

async function main() {
  const input = await readInput();
  const { db } = await import("@finanzas/db");
  const { createSocialPost, renderSocialMedia } = await import("../services/social.ts");

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
  const targets = (
    input.targets ?? [
      { network: "INSTAGRAM", placement: "IG_FEED" },
      { network: "FACEBOOK", placement: "FB_FEED" },
    ]
  ).map((t) => ({
    accountId: t.accountId ?? accountId,
    network: t.network,
    placement: t.placement,
  }));

  const post = await createSocialPost(
    {
      title: input.title,
      caption: input.caption,
      hashtags: input.hashtags ?? [],
      media: [],
      mediaType: input.mediaType ?? "IMAGE",
      aspectRatio: input.aspectRatio ?? "RATIO_4_5",
      targets,
      scheduledAt: input.scheduledAt,
    },
    user.id
  );

  let mediaUrl: string | null = null;
  if (input.template) {
    const rendered = await renderSocialMedia({
      id: post.id,
      template: input.template,
      props: input.props ?? {},
    });
    mediaUrl = rendered.media[0]?.url ?? null;
  }

  console.log(
    JSON.stringify({ ok: true, postId: post.id, status: post.status, mediaUrl }, null, 2)
  );
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
