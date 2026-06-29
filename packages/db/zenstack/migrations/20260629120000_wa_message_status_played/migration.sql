-- Voice-note "played" status (Meta sends status:"played" the first time a
-- recipient plays a voice note, 2026). Additive + idempotent enum value.
ALTER TYPE "WaMessageStatus" ADD VALUE IF NOT EXISTS 'PLAYED';
