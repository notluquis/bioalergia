// Seed idempotente de los artículos del blog público (/noticias).
// Lee seed-site-content.data.json (mismo dir). Upsert por slug.
// Uso: cd apps/api && node --env-file=.env src/scripts/seed-site-content.ts
//
// El resto del contenido del site es estático (hardcoded en apps/site/src/data).

import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { db } from "@finanzas/db";
import type { BodyBlock } from "@finanzas/orpc-contracts/site-content";

type SeedFile = {
  articles: Array<{
    slug: string;
    title: string;
    category: string;
    excerpt: string;
    reading_minutes: number;
    published_at: string | null;
    body: BodyBlock[];
  }>;
};

function plain<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

async function main() {
  const here = dirname(fileURLToPath(import.meta.url));
  const seed = JSON.parse(
    await readFile(join(here, "seed-site-content.data.json"), "utf8")
  ) as SeedFile;

  let articleOk = 0;
  for (const a of seed.articles) {
    const body = plain(a.body);
    const publishedAt = a.published_at ? new Date(a.published_at) : new Date();
    await db.article.upsert({
      where: { slug: a.slug },
      create: {
        slug: a.slug,
        title: a.title,
        category: a.category,
        excerpt: a.excerpt,
        readingMinutes: a.reading_minutes,
        body,
        status: "PUBLISHED",
        publishedAt,
      },
      update: {
        title: a.title,
        category: a.category,
        excerpt: a.excerpt,
        readingMinutes: a.reading_minutes,
        body,
        status: "PUBLISHED",
        publishedAt,
      },
    });
    articleOk += 1;
  }

  console.log(`[seed] ${articleOk} articles`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("[seed] failed:", err);
    process.exit(1);
  });
