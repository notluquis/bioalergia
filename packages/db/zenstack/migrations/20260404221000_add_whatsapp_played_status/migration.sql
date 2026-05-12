ALTER TABLE "public"."whatsapp_notifications"
ADD COLUMN IF NOT EXISTS "played_at" TIMESTAMP(3);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    WHERE t.typname = 'WhatsappNotificationStatus'
      AND e.enumlabel = 'PLAYED'
  ) THEN
    ALTER TYPE "public"."WhatsappNotificationStatus" ADD VALUE 'PLAYED';
  END IF;
END $$;
