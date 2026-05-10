-- CreateEnum
CREATE TYPE "WaSnippetKind" AS ENUM ('TEXT', 'MEDIA_DOCUMENT', 'MEDIA_IMAGE', 'MEDIA_VIDEO', 'MEDIA_AUDIO', 'MEDIA_STICKER', 'CTA_URL', 'REPLY_BUTTONS');

-- CreateTable
CREATE TABLE "wa_snippets" (
    "id" SERIAL NOT NULL,
    "account_id" INTEGER,
    "kind" "WaSnippetKind" NOT NULL,
    "category" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "shortcut" TEXT,
    "body_text" TEXT,
    "cta_url" TEXT,
    "cta_button_text" TEXT,
    "cta_header" TEXT,
    "cta_footer" TEXT,
    "reply_buttons" JSONB,
    "reply_header" TEXT,
    "reply_footer" TEXT,
    "media_handle" TEXT,
    "media_handle_expires_at" TIMESTAMP(3),
    "media_url" TEXT,
    "media_mime_type" TEXT,
    "media_filename" TEXT,
    "media_size" INTEGER,
    "media_uploaded_by_phone_number_id" INTEGER,
    "variables" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "hit_count" INTEGER NOT NULL DEFAULT 0,
    "last_used_at" TIMESTAMP(3),
    "created_by_user_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wa_snippets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "wa_snippets_archived_kind_idx" ON "wa_snippets"("archived", "kind");

-- CreateIndex
CREATE INDEX "wa_snippets_category_idx" ON "wa_snippets"("category");

-- CreateIndex
CREATE INDEX "wa_snippets_shortcut_idx" ON "wa_snippets"("shortcut");
