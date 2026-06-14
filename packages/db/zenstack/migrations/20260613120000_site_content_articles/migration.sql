-- Article: blog del site público (/noticias), editable desde intranet.
-- Aditivo + idempotente: prod tiene drift, se aplica vía psql directo
-- (regla repo: cambios aditivos IF NOT EXISTS, nunca migrate dev/reset).

-- CreateEnum (idempotente)
DO $$ BEGIN
  CREATE TYPE "ContentStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- CreateTable articles
CREATE TABLE IF NOT EXISTS "articles" (
    "id" SERIAL NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "excerpt" TEXT NOT NULL,
    "reading_minutes" INTEGER NOT NULL DEFAULT 4,
    "body" JSONB NOT NULL,
    "status" "ContentStatus" NOT NULL DEFAULT 'DRAFT',
    "seo_title" TEXT,
    "seo_description" TEXT,
    "published_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "articles_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "articles_slug_key" ON "articles"("slug");
CREATE INDEX IF NOT EXISTS "articles_status_idx" ON "articles"("status");
CREATE INDEX IF NOT EXISTS "articles_slug_idx" ON "articles"("slug");
CREATE INDEX IF NOT EXISTS "articles_published_at_idx" ON "articles"("published_at");
