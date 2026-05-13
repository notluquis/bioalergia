CREATE TYPE "WaPushPreviewMode" AS ENUM ('GENERIC', 'SENDER_NAME', 'FULL');

ALTER TABLE "users"
  ADD COLUMN "push_preview_mode" "WaPushPreviewMode" NOT NULL DEFAULT 'GENERIC';
