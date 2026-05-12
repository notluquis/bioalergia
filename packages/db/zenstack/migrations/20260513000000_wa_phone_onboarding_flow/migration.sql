-- Track how a WhatsApp phone number was onboarded so the app can surface
-- flow-specific behaviour (Coexistence has 5 mps cap, Messaging Echoes, etc.).
ALTER TABLE "wa_phone_numbers"
  ADD COLUMN IF NOT EXISTS "onboarding_flow" TEXT;

CREATE INDEX IF NOT EXISTS "wa_phone_numbers_onboarding_flow_idx"
  ON "wa_phone_numbers" ("onboarding_flow");
