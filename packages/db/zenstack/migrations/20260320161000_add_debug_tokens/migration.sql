CREATE TABLE "public"."debug_tokens" (
  "id" SERIAL NOT NULL,
  "jti" TEXT NOT NULL,
  "issued_by_user_id" INTEGER NOT NULL,
  "target_user_id" INTEGER NOT NULL,
  "audience" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "scopes" JSONB NOT NULL,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "used_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "debug_tokens_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "debug_tokens_jti_key" ON "public"."debug_tokens"("jti");
CREATE INDEX "debug_tokens_target_user_id_idx" ON "public"."debug_tokens"("target_user_id");
CREATE INDEX "debug_tokens_expires_at_idx" ON "public"."debug_tokens"("expires_at");

ALTER TABLE "public"."debug_tokens"
  ADD CONSTRAINT "debug_tokens_issued_by_user_id_fkey"
  FOREIGN KEY ("issued_by_user_id") REFERENCES "public"."users"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "public"."debug_tokens"
  ADD CONSTRAINT "debug_tokens_target_user_id_fkey"
  FOREIGN KEY ("target_user_id") REFERENCES "public"."users"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
