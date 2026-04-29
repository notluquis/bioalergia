-- CreateEnum
CREATE TYPE "DoctoraliaSyncType" AS ENUM ('CALENDAR', 'EMAIL');

-- CreateEnum
CREATE TYPE "OutreachDependencia" AS ENUM ('MUNICIPAL', 'PARTICULAR_SUBVENCIONADO', 'PARTICULAR_PAGADO', 'SLEP', 'CORPORACION_MUNICIPAL', 'OTRO');

-- CreateEnum
CREATE TYPE "OutreachStatus" AS ENUM ('SIN_CONTACTAR', 'CONTACTADO', 'SIN_RESPUESTA', 'RESPONDIO_INTERES', 'RESPONDIO_MAS_INFO', 'RESPONDIO_DESISTIO', 'REUNION_AGENDADA', 'CONVENIO_FIRMADO', 'DESCARTADO');

-- CreateEnum
CREATE TYPE "OutreachPriority" AS ENUM ('ALTA', 'MEDIA', 'BAJA');

-- CreateEnum
CREATE TYPE "OutreachProspectType" AS ENUM ('COLEGIO', 'EMPRESA', 'MUNICIPIO', 'INSTITUCION', 'UNIVERSIDAD', 'OTRO');

-- CreateEnum
CREATE TYPE "OutreachProspectSource" AS ENUM ('MINEDUC', 'GOOGLE_PLACES', 'CRAWLER', 'APOLLO', 'HUNTER', 'MANUAL');

-- CreateEnum
CREATE TYPE "OutreachInteractionType" AS ENUM ('EMAIL_ENVIADO', 'EMAIL_RECIBIDO', 'LLAMADA_REALIZADA', 'LLAMADA_RECIBIDA', 'WHATSAPP', 'REUNION_PRESENCIAL', 'REUNION_ONLINE', 'CHARLA_REALIZADA', 'NOTA_INTERNA');

-- CreateEnum
CREATE TYPE "OutreachCampaignStatus" AS ENUM ('BORRADOR', 'REVISION', 'ENVIANDO', 'COMPLETADA', 'PAUSADA', 'CANCELADA');

-- CreateEnum
CREATE TYPE "OutreachDeliveryStatus" AS ENUM ('PENDIENTE', 'ENVIADO', 'ERROR', 'REBOTADO', 'ABIERTO', 'RESPONDIDO');

-- CreateEnum
CREATE TYPE "WaMessageDirection" AS ENUM ('INBOUND', 'OUTBOUND');

-- CreateEnum
CREATE TYPE "WaMessageStatus" AS ENUM ('PENDING', 'SENT', 'DELIVERED', 'READ', 'FAILED', 'DELETED');

-- CreateEnum
CREATE TYPE "WaMessageType" AS ENUM ('TEXT', 'IMAGE', 'VIDEO', 'AUDIO', 'DOCUMENT', 'STICKER', 'LOCATION', 'CONTACTS', 'INTERACTIVE', 'BUTTON', 'TEMPLATE', 'REACTION', 'SYSTEM', 'UNSUPPORTED');

-- CreateEnum
CREATE TYPE "WaConversationStatus" AS ENUM ('OPEN', 'PENDING', 'CLOSED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "WaTemplateStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'DISABLED', 'PAUSED');

-- CreateEnum
CREATE TYPE "WaTemplateCategory" AS ENUM ('MARKETING', 'UTILITY', 'AUTHENTICATION');

-- DropForeignKey
ALTER TABLE "attendance_marks" DROP CONSTRAINT "attendance_marks_created_by_user_id_fkey";

-- DropForeignKey
ALTER TABLE "attendance_marks" DROP CONSTRAINT "attendance_marks_employee_id_fkey";

-- DropForeignKey
ALTER TABLE "clinical_series_merge_log" DROP CONSTRAINT "clinical_series_merge_log_merged_by_fkey";

-- DropForeignKey
ALTER TABLE "clinical_series_merge_log" DROP CONSTRAINT "clinical_series_merge_log_target_id_fkey";

-- DropForeignKey
ALTER TABLE "clinical_skin_test_imports" DROP CONSTRAINT "clinical_skin_test_imports_duplicate_of_import_id_fkey";

-- DropForeignKey
ALTER TABLE "doctoralia_email_notifications" DROP CONSTRAINT "doctoralia_email_notifications_calendar_appointment_id_fkey";

-- DropForeignKey
ALTER TABLE "event_dte_auto_link_attempts" DROP CONSTRAINT "event_dte_auto_link_attempts_candidate_dte_sale_detail_id_fkey";

-- DropForeignKey
ALTER TABLE "event_dte_auto_link_attempts" DROP CONSTRAINT "event_dte_auto_link_attempts_created_by_fkey";

-- DropForeignKey
ALTER TABLE "event_dte_auto_link_attempts" DROP CONSTRAINT "event_dte_auto_link_attempts_event_id_fkey";

-- DropForeignKey
ALTER TABLE "event_dte_match_reviews" DROP CONSTRAINT "event_dte_match_reviews_created_by_fkey";

-- DropForeignKey
ALTER TABLE "event_dte_match_reviews" DROP CONSTRAINT "event_dte_match_reviews_event_id_fkey";

-- DropForeignKey
ALTER TABLE "event_dte_sale_links" DROP CONSTRAINT "event_dte_sale_links_created_by_fkey";

-- DropForeignKey
ALTER TABLE "event_dte_sale_links" DROP CONSTRAINT "event_dte_sale_links_dte_sale_detail_id_fkey";

-- DropForeignKey
ALTER TABLE "event_dte_sale_links" DROP CONSTRAINT "event_dte_sale_links_event_id_fkey";

-- DropForeignKey
ALTER TABLE "patient_campaign_recipients" DROP CONSTRAINT "patient_campaign_recipients_campaign_id_fkey";

-- DropIndex
DROP INDEX "clinical_skin_test_imports_duplicate_of_import_id_idx";

-- DropIndex
DROP INDEX "clinical_skin_test_imports_result_hash_idx";

-- DropIndex
DROP INDEX "event_dte_sale_links_dte_sale_detail_id_idx";

-- AlterTable
ALTER TABLE "attendance_marks" ALTER COLUMN "marked_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "baileys_auth_keys" DROP COLUMN "updated_at";

-- AlterTable
ALTER TABLE "clinical_series" ADD COLUMN     "beneficiary_phones" JSONB,
ADD COLUMN     "patient_phones" JSONB,
ALTER COLUMN "beneficiary_rut" SET DATA TYPE TEXT;

-- AlterTable
ALTER TABLE "clinical_series_merge_log" ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "debug_tokens" ALTER COLUMN "expires_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "used_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "doctoralia_sync_logs" DROP COLUMN "sync_type",
ADD COLUMN     "sync_type" "DoctoraliaSyncType" NOT NULL DEFAULT 'CALENDAR';

-- AlterTable
ALTER TABLE "event_dte_auto_link_attempts" ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "event_dte_match_reviews" ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "event_dte_sale_links" ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "events" ALTER COLUMN "patient_rut" SET DATA TYPE TEXT,
ALTER COLUMN "beneficiary_rut" SET DATA TYPE TEXT;

-- AlterTable
ALTER TABLE "patient_campaign_recipients" ALTER COLUMN "sent_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "responded_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "patient_campaigns" ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "whatsapp_blocked_jids" ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "whatsapp_business_chat_labels" ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "whatsapp_business_labels" ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "whatsapp_business_message_labels" ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "whatsapp_business_quick_replies" ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "whatsapp_chats" ALTER COLUMN "conversation_timestamp" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "mute_end_time" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "is_blocked" DROP NOT NULL,
ALTER COLUMN "is_group" DROP NOT NULL;

-- AlterTable
ALTER TABLE "whatsapp_contacts" ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "whatsapp_conversation_state" ALTER COLUMN "last_inbound_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "window_expires_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "last_inbound_call_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "opted_in_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "opted_out_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "conversation_expires_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "whatsapp_group_participants" ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "whatsapp_groups" ALTER COLUMN "creation" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "whatsapp_message_reactions" ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "whatsapp_message_receipts" ALTER COLUMN "receipt_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "read_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "played_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "whatsapp_messages" ALTER COLUMN "sent_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "delivered_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "read_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "played_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "message_timestamp" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "whatsapp_notifications" ALTER COLUMN "appointment_date" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "sent_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "delivered_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "read_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "whatsapp_presence_states" ALTER COLUMN "last_seen" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMP(3);

-- CreateTable
CREATE TABLE "dte_line_items" (
    "id" TEXT NOT NULL,
    "line_number" INTEGER NOT NULL,
    "item_name" TEXT NOT NULL,
    "item_description" TEXT,
    "quantity" DECIMAL(15,6) NOT NULL DEFAULT 1,
    "unit" VARCHAR(10),
    "unit_price" DECIMAL(15,6) NOT NULL DEFAULT 0,
    "amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "is_exempt" BOOLEAN NOT NULL DEFAULT false,
    "item_code" VARCHAR(50),
    "item_code_type" VARCHAR(20),
    "discount_percent" DECIMAL(5,2),
    "discount_amount" DECIMAL(15,2),
    "dte_sale_detail_id" TEXT,
    "dte_purchase_detail_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dte_line_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "outreach_establishments" (
    "rbd" VARCHAR(64) NOT NULL,
    "nombre" TEXT NOT NULL,
    "tipo" "OutreachProspectType" NOT NULL DEFAULT 'COLEGIO',
    "fuente" "OutreachProspectSource" NOT NULL DEFAULT 'MINEDUC',
    "dependencia" "OutreachDependencia" NOT NULL DEFAULT 'OTRO',
    "comuna" TEXT NOT NULL,
    "ciudad" TEXT,
    "region" TEXT NOT NULL,
    "direccion" TEXT,
    "telefono_mineduc" TEXT,
    "email_mineduc" TEXT,
    "director_mineduc" TEXT,
    "matricula_total" INTEGER,
    "rural" BOOLEAN NOT NULL DEFAULT false,
    "google_place_id" TEXT,
    "categoria" TEXT,
    "dominio" TEXT,
    "rating" DOUBLE PRECISION,
    "total_reviews" INTEGER,
    "estado_negocio" TEXT,
    "linkedin_url" TEXT,
    "apollo_org_id" TEXT,
    "apollo_last_fetched_at" TIMESTAMP(3),
    "hunter_last_fetched_at" TIMESTAMP(3),
    "hunter_email_pattern" TEXT,
    "crawled_at" TIMESTAMP(3),
    "crawl_success" BOOLEAN NOT NULL DEFAULT false,
    "score" INTEGER NOT NULL DEFAULT 0,
    "website_url" TEXT,
    "emails_adicionales" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "telefonos_adicionales" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "notas" TEXT,
    "prioridad" "OutreachPriority" NOT NULL DEFAULT 'MEDIA',
    "etiquetas" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "estado" "OutreachStatus" NOT NULL DEFAULT 'SIN_CONTACTAR',
    "ultimo_contacto_at" TIMESTAMP(3),
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "importado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "outreach_establishments_pkey" PRIMARY KEY ("rbd")
);

-- CreateTable
CREATE TABLE "outreach_contacts" (
    "id" SERIAL NOT NULL,
    "establecimiento_rbd" VARCHAR(64) NOT NULL,
    "nombre" TEXT NOT NULL,
    "cargo" TEXT NOT NULL,
    "email" TEXT,
    "telefono" TEXT,
    "es_principal" BOOLEAN NOT NULL DEFAULT false,
    "notas" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "outreach_contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "outreach_interactions" (
    "id" SERIAL NOT NULL,
    "establecimiento_rbd" VARCHAR(64) NOT NULL,
    "contacto_id" INTEGER,
    "tipo" "OutreachInteractionType" NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "asunto" TEXT,
    "contenido" TEXT NOT NULL,
    "email_desde" TEXT,
    "email_hacia" TEXT,
    "resultado" TEXT,
    "creado_por_user_id" INTEGER,
    "creado_por_nombre" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "outreach_interactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "outreach_email_campaigns" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "asunto" TEXT NOT NULL,
    "cuerpo_html" TEXT NOT NULL,
    "cuerpo_texto" TEXT NOT NULL,
    "from_email" TEXT NOT NULL,
    "from_nombre" TEXT NOT NULL,
    "reply_to" TEXT,
    "filtros" JSONB NOT NULL DEFAULT '{}',
    "rate_per_hour" INTEGER NOT NULL DEFAULT 50,
    "estado" "OutreachCampaignStatus" NOT NULL DEFAULT 'BORRADOR',
    "total_destinatarios" INTEGER NOT NULL DEFAULT 0,
    "enviados" INTEGER NOT NULL DEFAULT 0,
    "errores" INTEGER NOT NULL DEFAULT 0,
    "respondidos" INTEGER NOT NULL DEFAULT 0,
    "created_by_user_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "enviado_en" TIMESTAMP(3),

    CONSTRAINT "outreach_email_campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "outreach_email_deliveries" (
    "id" SERIAL NOT NULL,
    "campaign_id" INTEGER NOT NULL,
    "establecimiento_rbd" VARCHAR(64) NOT NULL,
    "contacto_id" INTEGER,
    "email_destinatario" TEXT NOT NULL,
    "asunto_render" TEXT,
    "cuerpo_html_render" TEXT,
    "cuerpo_texto_render" TEXT,
    "estado" "OutreachDeliveryStatus" NOT NULL DEFAULT 'PENDIENTE',
    "error_mensaje" TEXT,
    "intentos" INTEGER NOT NULL DEFAULT 0,
    "enviado_en" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "outreach_email_deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "outreach_import_logs" (
    "id" SERIAL NOT NULL,
    "source" TEXT NOT NULL,
    "file_url" TEXT,
    "total_rows" INTEGER NOT NULL DEFAULT 0,
    "nuevos" INTEGER NOT NULL DEFAULT 0,
    "actualizados" INTEGER NOT NULL DEFAULT 0,
    "inactivos" INTEGER NOT NULL DEFAULT 0,
    "errores" INTEGER NOT NULL DEFAULT 0,
    "error_detalle" TEXT,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMP(3),
    "created_by_user_id" INTEGER,

    CONSTRAINT "outreach_import_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wa_business_accounts" (
    "id" SERIAL NOT NULL,
    "waba_id" TEXT NOT NULL,
    "meta_business_id" TEXT,
    "app_id" TEXT,
    "app_secret" TEXT,
    "system_user_token" TEXT,
    "webhook_verify_token" TEXT,
    "graph_api_version" TEXT NOT NULL DEFAULT 'v21.0',
    "display_name" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wa_business_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wa_phone_numbers" (
    "id" SERIAL NOT NULL,
    "account_id" INTEGER NOT NULL,
    "phone_number_id" TEXT NOT NULL,
    "display_phone_number" TEXT NOT NULL,
    "label" TEXT,
    "quality_rating" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wa_phone_numbers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wa_contacts" (
    "id" SERIAL NOT NULL,
    "phone_e164" TEXT NOT NULL,
    "name" TEXT,
    "push_name" TEXT,
    "opt_in_status" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "notas" TEXT,
    "etiquetas" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "patient_rut" VARCHAR(20),
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wa_contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wa_conversations" (
    "id" SERIAL NOT NULL,
    "contact_id" INTEGER NOT NULL,
    "status" "WaConversationStatus" NOT NULL DEFAULT 'OPEN',
    "assigned_to_user_id" INTEGER,
    "unread_count" INTEGER NOT NULL DEFAULT 0,
    "last_inbound_at" TIMESTAMP(3),
    "last_message_at" TIMESTAMP(3),
    "last_message_preview" TEXT,
    "notas" TEXT,
    "etiquetas" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wa_conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wa_conversation_channels" (
    "id" SERIAL NOT NULL,
    "conversation_id" INTEGER NOT NULL,
    "phone_number_id" INTEGER NOT NULL,
    "last_message_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wa_conversation_channels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wa_messages" (
    "id" SERIAL NOT NULL,
    "conversation_id" INTEGER NOT NULL,
    "contact_id" INTEGER NOT NULL,
    "phone_number_id" INTEGER NOT NULL,
    "meta_message_id" TEXT,
    "direction" "WaMessageDirection" NOT NULL,
    "type" "WaMessageType" NOT NULL,
    "status" "WaMessageStatus" NOT NULL DEFAULT 'PENDING',
    "body" TEXT,
    "media_url" TEXT,
    "media_mime_type" TEXT,
    "media_caption" TEXT,
    "template_name" TEXT,
    "template_language" TEXT,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "error_code" TEXT,
    "error_title" TEXT,
    "error_details" TEXT,
    "sent_by_user_id" INTEGER,
    "context_meta_message_id" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "delivered_at" TIMESTAMP(3),
    "read_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wa_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wa_templates" (
    "id" SERIAL NOT NULL,
    "account_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "category" "WaTemplateCategory" NOT NULL DEFAULT 'UTILITY',
    "status" "WaTemplateStatus" NOT NULL DEFAULT 'PENDING',
    "components" JSONB NOT NULL DEFAULT '[]',
    "quality_score" TEXT,
    "meta_template_id" TEXT,
    "synced_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wa_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wa_webhook_logs" (
    "id" SERIAL NOT NULL,
    "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "signature_valid" BOOLEAN NOT NULL,
    "payload" JSONB NOT NULL,
    "processed" BOOLEAN NOT NULL DEFAULT false,
    "error_message" TEXT,
    "event_count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "wa_webhook_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "dte_line_items_dte_sale_detail_id_idx" ON "dte_line_items"("dte_sale_detail_id");

-- CreateIndex
CREATE INDEX "dte_line_items_dte_purchase_detail_id_idx" ON "dte_line_items"("dte_purchase_detail_id");

-- CreateIndex
CREATE UNIQUE INDEX "dte_line_items_dte_sale_detail_id_line_number_key" ON "dte_line_items"("dte_sale_detail_id", "line_number");

-- CreateIndex
CREATE UNIQUE INDEX "dte_line_items_dte_purchase_detail_id_line_number_key" ON "dte_line_items"("dte_purchase_detail_id", "line_number");

-- CreateIndex
CREATE UNIQUE INDEX "outreach_establishments_google_place_id_key" ON "outreach_establishments"("google_place_id");

-- CreateIndex
CREATE INDEX "outreach_establishments_estado_idx" ON "outreach_establishments"("estado");

-- CreateIndex
CREATE INDEX "outreach_establishments_dependencia_idx" ON "outreach_establishments"("dependencia");

-- CreateIndex
CREATE INDEX "outreach_establishments_comuna_idx" ON "outreach_establishments"("comuna");

-- CreateIndex
CREATE INDEX "outreach_establishments_prioridad_idx" ON "outreach_establishments"("prioridad");

-- CreateIndex
CREATE INDEX "outreach_establishments_activo_idx" ON "outreach_establishments"("activo");

-- CreateIndex
CREATE INDEX "outreach_establishments_tipo_idx" ON "outreach_establishments"("tipo");

-- CreateIndex
CREATE INDEX "outreach_establishments_fuente_idx" ON "outreach_establishments"("fuente");

-- CreateIndex
CREATE INDEX "outreach_establishments_dominio_idx" ON "outreach_establishments"("dominio");

-- CreateIndex
CREATE INDEX "outreach_establishments_score_idx" ON "outreach_establishments"("score");

-- CreateIndex
CREATE INDEX "outreach_contacts_establecimiento_rbd_idx" ON "outreach_contacts"("establecimiento_rbd");

-- CreateIndex
CREATE INDEX "outreach_contacts_email_idx" ON "outreach_contacts"("email");

-- CreateIndex
CREATE INDEX "outreach_interactions_establecimiento_rbd_idx" ON "outreach_interactions"("establecimiento_rbd");

-- CreateIndex
CREATE INDEX "outreach_interactions_contacto_id_idx" ON "outreach_interactions"("contacto_id");

-- CreateIndex
CREATE INDEX "outreach_interactions_tipo_idx" ON "outreach_interactions"("tipo");

-- CreateIndex
CREATE INDEX "outreach_interactions_fecha_idx" ON "outreach_interactions"("fecha");

-- CreateIndex
CREATE INDEX "outreach_email_campaigns_estado_idx" ON "outreach_email_campaigns"("estado");

-- CreateIndex
CREATE INDEX "outreach_email_campaigns_created_by_user_id_idx" ON "outreach_email_campaigns"("created_by_user_id");

-- CreateIndex
CREATE INDEX "outreach_email_deliveries_campaign_id_idx" ON "outreach_email_deliveries"("campaign_id");

-- CreateIndex
CREATE INDEX "outreach_email_deliveries_establecimiento_rbd_idx" ON "outreach_email_deliveries"("establecimiento_rbd");

-- CreateIndex
CREATE INDEX "outreach_email_deliveries_estado_idx" ON "outreach_email_deliveries"("estado");

-- CreateIndex
CREATE UNIQUE INDEX "wa_business_accounts_waba_id_key" ON "wa_business_accounts"("waba_id");

-- CreateIndex
CREATE UNIQUE INDEX "wa_phone_numbers_phone_number_id_key" ON "wa_phone_numbers"("phone_number_id");

-- CreateIndex
CREATE INDEX "wa_phone_numbers_account_id_idx" ON "wa_phone_numbers"("account_id");

-- CreateIndex
CREATE UNIQUE INDEX "wa_contacts_phone_e164_key" ON "wa_contacts"("phone_e164");

-- CreateIndex
CREATE INDEX "wa_contacts_patient_rut_idx" ON "wa_contacts"("patient_rut");

-- CreateIndex
CREATE INDEX "wa_conversations_status_idx" ON "wa_conversations"("status");

-- CreateIndex
CREATE INDEX "wa_conversations_assigned_to_user_id_idx" ON "wa_conversations"("assigned_to_user_id");

-- CreateIndex
CREATE INDEX "wa_conversations_last_message_at_idx" ON "wa_conversations"("last_message_at");

-- CreateIndex
CREATE UNIQUE INDEX "wa_conversations_contact_id_key" ON "wa_conversations"("contact_id");

-- CreateIndex
CREATE INDEX "wa_conversation_channels_phone_number_id_idx" ON "wa_conversation_channels"("phone_number_id");

-- CreateIndex
CREATE UNIQUE INDEX "wa_conversation_channels_conversation_id_phone_number_id_key" ON "wa_conversation_channels"("conversation_id", "phone_number_id");

-- CreateIndex
CREATE INDEX "wa_messages_conversation_id_idx" ON "wa_messages"("conversation_id");

-- CreateIndex
CREATE INDEX "wa_messages_contact_id_idx" ON "wa_messages"("contact_id");

-- CreateIndex
CREATE INDEX "wa_messages_phone_number_id_idx" ON "wa_messages"("phone_number_id");

-- CreateIndex
CREATE INDEX "wa_messages_timestamp_idx" ON "wa_messages"("timestamp");

-- CreateIndex
CREATE INDEX "wa_messages_direction_status_idx" ON "wa_messages"("direction", "status");

-- CreateIndex
CREATE UNIQUE INDEX "wa_messages_meta_message_id_key" ON "wa_messages"("meta_message_id");

-- CreateIndex
CREATE INDEX "wa_templates_status_idx" ON "wa_templates"("status");

-- CreateIndex
CREATE UNIQUE INDEX "wa_templates_account_id_name_language_key" ON "wa_templates"("account_id", "name", "language");

-- CreateIndex
CREATE INDEX "wa_webhook_logs_received_at_idx" ON "wa_webhook_logs"("received_at");

-- CreateIndex
CREATE INDEX "doctoralia_sync_logs_sync_type_idx" ON "doctoralia_sync_logs"("sync_type");

-- AddForeignKey
ALTER TABLE "attendance_marks" ADD CONSTRAINT "attendance_marks_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_marks" ADD CONSTRAINT "attendance_marks_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clinical_series_merge_log" ADD CONSTRAINT "clinical_series_merge_log_target_id_fkey" FOREIGN KEY ("target_id") REFERENCES "clinical_series"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "doctoralia_email_notifications" ADD CONSTRAINT "doctoralia_email_notifications_calendar_appointment_id_fkey" FOREIGN KEY ("calendar_appointment_id") REFERENCES "doctoralia_calendar_appointments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dte_line_items" ADD CONSTRAINT "dte_line_items_dte_sale_detail_id_fkey" FOREIGN KEY ("dte_sale_detail_id") REFERENCES "dte_sale_details"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dte_line_items" ADD CONSTRAINT "dte_line_items_dte_purchase_detail_id_fkey" FOREIGN KEY ("dte_purchase_detail_id") REFERENCES "dte_purchase_details"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_dte_sale_links" ADD CONSTRAINT "event_dte_sale_links_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_dte_sale_links" ADD CONSTRAINT "event_dte_sale_links_dte_sale_detail_id_fkey" FOREIGN KEY ("dte_sale_detail_id") REFERENCES "dte_sale_details"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_dte_sale_links" ADD CONSTRAINT "event_dte_sale_links_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_dte_auto_link_attempts" ADD CONSTRAINT "event_dte_auto_link_attempts_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_dte_auto_link_attempts" ADD CONSTRAINT "event_dte_auto_link_attempts_candidate_dte_sale_detail_id_fkey" FOREIGN KEY ("candidate_dte_sale_detail_id") REFERENCES "dte_sale_details"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_dte_auto_link_attempts" ADD CONSTRAINT "event_dte_auto_link_attempts_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_dte_match_reviews" ADD CONSTRAINT "event_dte_match_reviews_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_dte_match_reviews" ADD CONSTRAINT "event_dte_match_reviews_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patient_campaign_recipients" ADD CONSTRAINT "patient_campaign_recipients_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "patient_campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outreach_contacts" ADD CONSTRAINT "outreach_contacts_establecimiento_rbd_fkey" FOREIGN KEY ("establecimiento_rbd") REFERENCES "outreach_establishments"("rbd") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outreach_interactions" ADD CONSTRAINT "outreach_interactions_establecimiento_rbd_fkey" FOREIGN KEY ("establecimiento_rbd") REFERENCES "outreach_establishments"("rbd") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outreach_interactions" ADD CONSTRAINT "outreach_interactions_contacto_id_fkey" FOREIGN KEY ("contacto_id") REFERENCES "outreach_contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outreach_email_deliveries" ADD CONSTRAINT "outreach_email_deliveries_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "outreach_email_campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outreach_email_deliveries" ADD CONSTRAINT "outreach_email_deliveries_establecimiento_rbd_fkey" FOREIGN KEY ("establecimiento_rbd") REFERENCES "outreach_establishments"("rbd") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outreach_email_deliveries" ADD CONSTRAINT "outreach_email_deliveries_contacto_id_fkey" FOREIGN KEY ("contacto_id") REFERENCES "outreach_contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wa_phone_numbers" ADD CONSTRAINT "wa_phone_numbers_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "wa_business_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wa_conversations" ADD CONSTRAINT "wa_conversations_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "wa_contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wa_conversation_channels" ADD CONSTRAINT "wa_conversation_channels_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "wa_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wa_conversation_channels" ADD CONSTRAINT "wa_conversation_channels_phone_number_id_fkey" FOREIGN KEY ("phone_number_id") REFERENCES "wa_phone_numbers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wa_messages" ADD CONSTRAINT "wa_messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "wa_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wa_messages" ADD CONSTRAINT "wa_messages_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "wa_contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wa_messages" ADD CONSTRAINT "wa_messages_phone_number_id_fkey" FOREIGN KEY ("phone_number_id") REFERENCES "wa_phone_numbers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wa_templates" ADD CONSTRAINT "wa_templates_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "wa_business_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "clinical_document_imports_account_drive_item_key" RENAME TO "clinical_document_imports_onedrive_account_id_onedrive_driv_key";

-- RenameIndex
ALTER INDEX "clinical_skin_test_imports_account_drive_item_key" RENAME TO "clinical_skin_test_imports_onedrive_account_id_onedrive_dri_key";

-- RenameIndex
ALTER INDEX "clinical_skin_test_results_source_import_id_section_code_allerg" RENAME TO "clinical_skin_test_results_source_import_id_section_code_al_key";

-- RenameIndex
ALTER INDEX "whatsapp_business_message_labels_chat_jid_message_id_updated_at" RENAME TO "whatsapp_business_message_labels_chat_jid_message_id_update_idx";

-- RenameIndex
ALTER INDEX "whatsapp_group_participants_group_idx" RENAME TO "whatsapp_group_participants_group_jid_updated_at_idx";

-- RenameIndex
ALTER INDEX "whatsapp_message_reactions_message_idx" RENAME TO "whatsapp_message_reactions_remote_jid_message_id_updated_at_idx";

-- RenameIndex
ALTER INDEX "whatsapp_message_receipts_message_idx" RENAME TO "whatsapp_message_receipts_remote_jid_message_id_updated_at_idx";

-- RenameIndex
ALTER INDEX "whatsapp_messages_remote_jid_message_id_participant_jid_key" RENAME TO "whatsapp_messages_remote_jid_message_id_participant_jid_key_key";

-- RenameIndex
ALTER INDEX "whatsapp_presence_states_chat_idx" RENAME TO "whatsapp_presence_states_chat_jid_updated_at_idx";

