-- Social media publishing: SocialAccount (cuentas Meta conectadas, tokens
-- encriptados + BUC rate-limit), SocialPost (post lógico aprobable) y
-- SocialPostTarget (fan-out por red/placement, espejo de wa_broadcast_recipients).
-- Aditivo + idempotente (regla repo: IF NOT EXISTS / DO-block, vía migrate deploy).

-- Enums (idempotentes: CREATE TYPE no soporta IF NOT EXISTS)
DO $$ BEGIN
  CREATE TYPE "SocialNetwork" AS ENUM ('INSTAGRAM', 'FACEBOOK', 'TIKTOK');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "SocialPlacement" AS ENUM ('IG_FEED', 'IG_REEL', 'IG_STORY', 'FB_FEED', 'FB_REEL', 'FB_STORY', 'TIKTOK_VIDEO');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "SocialMediaType" AS ENUM ('IMAGE', 'VIDEO', 'CAROUSEL');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "SocialAspectRatio" AS ENUM ('RATIO_4_5', 'RATIO_1_1', 'RATIO_9_16');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "SocialPostStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'SCHEDULED', 'PUBLISHING', 'PUBLISHED', 'FAILED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "SocialTargetStatus" AS ENUM ('PENDING', 'CREATING', 'CONTAINER_READY', 'PUBLISHING', 'PUBLISHED', 'FAILED', 'SKIPPED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "SocialAccountProvider" AS ENUM ('META');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateTable social_accounts
CREATE TABLE IF NOT EXISTS "social_accounts" (
    "id" SERIAL NOT NULL,
    "provider" "SocialAccountProvider" NOT NULL DEFAULT 'META',
    "display_name" TEXT,
    "meta_business_id" TEXT,
    "fb_page_id" TEXT,
    "ig_user_id" TEXT,
    "page_access_token" TEXT,
    "user_access_token" TEXT,
    "token_expires_at" TIMESTAMP(3),
    "app_id" TEXT,
    "app_secret" TEXT,
    "graph_api_version" TEXT NOT NULL DEFAULT 'v23.0',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "call_window_start" TIMESTAMP(3),
    "call_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "social_accounts_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "social_accounts_provider_idx" ON "social_accounts"("provider");

-- CreateTable social_posts
CREATE TABLE IF NOT EXISTS "social_posts" (
    "id" SERIAL NOT NULL,
    "title" TEXT,
    "status" "SocialPostStatus" NOT NULL DEFAULT 'DRAFT',
    "media_type" "SocialMediaType" NOT NULL,
    "aspect_ratio" "SocialAspectRatio" NOT NULL,
    "caption" TEXT,
    "hashtags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "media" JSONB NOT NULL DEFAULT '[]',
    "generation_meta" JSONB NOT NULL DEFAULT '{}',
    "scheduled_at" TIMESTAMP(3),
    "approved_by_user_id" INTEGER,
    "approved_at" TIMESTAMP(3),
    "rejected_reason" TEXT,
    "created_by_user_id" INTEGER NOT NULL,
    "published_at" TIMESTAMP(3),
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "social_posts_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "social_posts_status_idx" ON "social_posts"("status");
CREATE INDEX IF NOT EXISTS "social_posts_scheduled_at_idx" ON "social_posts"("scheduled_at");

-- CreateTable social_post_targets
CREATE TABLE IF NOT EXISTS "social_post_targets" (
    "id" SERIAL NOT NULL,
    "post_id" INTEGER NOT NULL,
    "account_id" INTEGER NOT NULL,
    "network" "SocialNetwork" NOT NULL,
    "placement" "SocialPlacement" NOT NULL,
    "status" "SocialTargetStatus" NOT NULL DEFAULT 'PENDING',
    "container_id" TEXT,
    "external_id" TEXT,
    "permalink" TEXT,
    "caption_override" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "error_code" TEXT,
    "error_message" TEXT,
    "container_created_at" TIMESTAMP(3),
    "published_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "social_post_targets_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "social_post_targets_post_id_network_placement_key" ON "social_post_targets"("post_id", "network", "placement");
CREATE INDEX IF NOT EXISTS "social_post_targets_post_id_status_idx" ON "social_post_targets"("post_id", "status");
CREATE INDEX IF NOT EXISTS "social_post_targets_status_idx" ON "social_post_targets"("status");

-- Foreign keys (idempotentes)
DO $$ BEGIN
  ALTER TABLE "social_post_targets"
    ADD CONSTRAINT "social_post_targets_post_id_fkey"
    FOREIGN KEY ("post_id") REFERENCES "social_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "social_post_targets"
    ADD CONSTRAINT "social_post_targets_account_id_fkey"
    FOREIGN KEY ("account_id") REFERENCES "social_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
