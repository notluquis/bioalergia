// Service layer para artículos del blog público (/noticias). Único contenido
// del site en DB + editable desde intranet; el resto de páginas son estáticas.
// Golden 2026: handlers finos → este service valida y lanza DomainError.
// `db` es privilegiado (no aplica @@allow); el gate de auth vive en el router.

import { db } from "@finanzas/db";
import type { BodyBlock } from "@finanzas/orpc-contracts/site-content";
import { DomainError } from "../lib/errors.ts";

// JSON columns rechazan `undefined`; normalizamos a JSON plano.
function toPlainJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

const ARTICLE_SUMMARY_SELECT = {
  id: true,
  slug: true,
  title: true,
  category: true,
  excerpt: true,
  readingMinutes: true,
  status: true,
  seoTitle: true,
  seoDescription: true,
  publishedAt: true,
  createdAt: true,
  updatedAt: true,
} as const;

export async function listPublishedArticles() {
  return await db.article.findMany({
    where: { status: "PUBLISHED" },
    select: ARTICLE_SUMMARY_SELECT,
    orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
  });
}

export async function getPublishedArticleBySlug(slug: string) {
  const row = await db.article.findFirst({ where: { slug, status: "PUBLISHED" } });
  if (!row) {
    throw new DomainError("NOT_FOUND", "Artículo no encontrado");
  }
  return row;
}

export async function listAllArticles() {
  return await db.article.findMany({
    select: ARTICLE_SUMMARY_SELECT,
    orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
  });
}

export async function getArticleById(id: number) {
  const row = await db.article.findUnique({ where: { id } });
  if (!row) {
    throw new DomainError("NOT_FOUND", "Artículo no encontrado");
  }
  return row;
}

type ArticleCreatePayload = {
  slug: string;
  title: string;
  category: string;
  excerpt: string;
  reading_minutes: number;
  body: BodyBlock[];
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  seo_title?: string | null;
  seo_description?: string | null;
  published_at?: Date | null;
};

function resolvePublishedAt(
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED",
  provided: Date | null | undefined
): Date | null {
  if (provided !== undefined && provided !== null) return provided;
  if (status === "PUBLISHED") return new Date();
  return null;
}

export async function createArticle(input: ArticleCreatePayload) {
  const existing = await db.article.findUnique({ where: { slug: input.slug } });
  if (existing) {
    throw new DomainError("CONFLICT", `Ya existe un artículo con el slug ${input.slug}`);
  }
  return await db.article.create({
    data: {
      slug: input.slug,
      title: input.title,
      category: input.category,
      excerpt: input.excerpt,
      readingMinutes: input.reading_minutes,
      body: toPlainJson(input.body),
      status: input.status,
      seoTitle: input.seo_title ?? null,
      seoDescription: input.seo_description ?? null,
      publishedAt: resolvePublishedAt(input.status, input.published_at),
    },
  });
}

export async function updateArticle(input: { id: number } & Partial<ArticleCreatePayload>) {
  const current = await db.article.findUnique({ where: { id: input.id } });
  if (!current) {
    throw new DomainError("NOT_FOUND", "Artículo no encontrado");
  }
  if (input.slug && input.slug !== current.slug) {
    const clash = await db.article.findUnique({ where: { slug: input.slug } });
    if (clash) {
      throw new DomainError("CONFLICT", `Ya existe un artículo con el slug ${input.slug}`);
    }
  }
  const nextStatus = input.status ?? current.status;
  const data: Record<string, unknown> = {};
  if (input.slug !== undefined) data.slug = input.slug;
  if (input.title !== undefined) data.title = input.title;
  if (input.category !== undefined) data.category = input.category;
  if (input.excerpt !== undefined) data.excerpt = input.excerpt;
  if (input.reading_minutes !== undefined) data.readingMinutes = input.reading_minutes;
  if (input.body !== undefined) data.body = toPlainJson(input.body);
  if (input.status !== undefined) data.status = input.status;
  if (input.seo_title !== undefined) data.seoTitle = input.seo_title;
  if (input.seo_description !== undefined) data.seoDescription = input.seo_description;
  if (input.published_at !== undefined) {
    data.publishedAt = input.published_at;
  } else if (nextStatus === "PUBLISHED" && current.publishedAt === null) {
    data.publishedAt = new Date();
  }
  return await db.article.update({ where: { id: input.id }, data });
}

export async function deleteArticle(id: number) {
  const current = await db.article.findUnique({ where: { id } });
  if (!current) {
    throw new DomainError("NOT_FOUND", "Artículo no encontrado");
  }
  await db.article.delete({ where: { id } });
}
