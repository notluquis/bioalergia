-- User lockout + activity tracking + AuditLog (Chile Law 20.584 + ASVS 5.0)
SET search_path TO public, personal;

-- User columns
ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "failed_login_attempts" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "locked_until" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "last_activity_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "last_login_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "last_login_ip" TEXT;

-- AuditLog enum
DO $$ BEGIN
  CREATE TYPE "AuditEventKind" AS ENUM (
    'LOGIN_SUCCESS','LOGIN_FAILURE','LOGIN_LOCKED','MFA_SUCCESS','MFA_FAILURE',
    'PASSWORD_CHANGE','PASSWORD_RESET','MFA_ENROLL','MFA_DISABLE',
    'PASSKEY_REGISTER','PASSKEY_DELETE','ROLE_GRANT','ROLE_REVOKE',
    'USER_CREATE','USER_DEACTIVATE','USER_REACTIVATE','DATA_EXPORT',
    'ADMIN_ACTION','WA_CONTACT_BLOCK','WA_CONTACT_UNBLOCK',
    'SETTINGS_UPDATE','OTHER'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AuditLog table
CREATE TABLE IF NOT EXISTS "audit_logs" (
  "id" BIGSERIAL PRIMARY KEY,
  "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "kind" "AuditEventKind" NOT NULL,
  "user_id" INTEGER,
  "actor_label" TEXT,
  "ip" TEXT,
  "user_agent" TEXT,
  "resource" TEXT,
  "resource_id" TEXT,
  "outcome" TEXT NOT NULL DEFAULT 'ok',
  "message" TEXT,
  "metadata" JSONB
);

CREATE INDEX IF NOT EXISTS "audit_logs_occurred_at_idx" ON "audit_logs" ("occurred_at");
CREATE INDEX IF NOT EXISTS "audit_logs_user_id_occurred_at_idx" ON "audit_logs" ("user_id", "occurred_at");
CREATE INDEX IF NOT EXISTS "audit_logs_kind_occurred_at_idx" ON "audit_logs" ("kind", "occurred_at");
