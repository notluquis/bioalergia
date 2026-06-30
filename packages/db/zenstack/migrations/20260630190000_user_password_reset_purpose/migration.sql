-- Marks what a live password-reset token was minted for: "invite" (completing
-- it activates a PENDING_SETUP account, skipping onboarding) vs null/"reset"
-- (forgot-password, which must never change status). Lets the two flows share
-- the password_reset_token_hash columns without one bypassing onboarding.
-- Additive + idempotent (prod has db-push drift; apply with `migrate deploy`).
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "password_reset_purpose" TEXT;
