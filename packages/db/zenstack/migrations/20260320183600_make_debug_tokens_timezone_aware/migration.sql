ALTER TABLE "public"."debug_tokens"
  ALTER COLUMN "expires_at" TYPE TIMESTAMPTZ(3) USING "expires_at" AT TIME ZONE 'America/Santiago',
  ALTER COLUMN "used_at" TYPE TIMESTAMPTZ(3) USING "used_at" AT TIME ZONE 'America/Santiago',
  ALTER COLUMN "created_at" TYPE TIMESTAMPTZ(3) USING "created_at" AT TIME ZONE 'America/Santiago',
  ALTER COLUMN "created_at" SET DEFAULT NOW();
