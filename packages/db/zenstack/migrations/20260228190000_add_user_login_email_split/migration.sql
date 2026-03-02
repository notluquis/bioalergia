-- Split login identity email from notification email (people.email)
-- users.login_email is nullable: when null, effective login email falls back to people.email

ALTER TABLE "users"
ADD COLUMN IF NOT EXISTS "login_email" VARCHAR(320);

-- Case-insensitive uniqueness for explicit login emails
CREATE UNIQUE INDEX IF NOT EXISTS "users_login_email_unique_ci_idx"
  ON "users" ((lower("login_email")))
  WHERE "login_email" IS NOT NULL;
