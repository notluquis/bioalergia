-- Dedupe state for security alert emissions. A separate table from
-- audit_logs because audit_logs is append-only and immutable; this is
-- the mutable per-(scope, alert_type) timestamp used to throttle
-- repeat alerts (default: 1 / hour / scope / type).
--
-- NIST 800-53r5 IR-4(1) "Automated Incident Handling" + AU-6(1)
-- explicitly allow alert deduplication; every underlying event is
-- still recorded in audit_logs for forensic purposes.
SET search_path TO public, personal;

CREATE TABLE IF NOT EXISTS "security_alert_state" (
  "scope"        TEXT NOT NULL,
  "alert_type"   TEXT NOT NULL,
  "last_sent_at" TIMESTAMP(3) NOT NULL,
  PRIMARY KEY ("scope", "alert_type")
);

CREATE INDEX IF NOT EXISTS "security_alert_state_last_sent_at_idx"
  ON "security_alert_state" ("last_sent_at");
