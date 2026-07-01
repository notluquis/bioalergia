// Patient intake collected via the WhatsApp Flow → IntakeSubmission. Pure mapping
// (mapFlowDataToIntake) + persistence (createIntakeFromFlow). The Flow's data
// keys are the contract with the Flow JSON (Phase 4): nombre/rut/correo/
// fecha_nacimiento/prevision/isapre/direccion/telefono/motivo/alergias/
// condiciones/es_menor/tutor_*. RUT is normalized if valid, else kept raw (staff
// verify). Decoupled from Person/Patient — staff create the record by hand.

import { db } from "@finanzas/db";
import { normalizeRut, validateRut } from "../lib/rut.ts";
import { formatChile } from "../lib/time.ts";
import { logError, logEvent } from "../lib/logger.ts";
import { type FlowPhoto, downloadAndDecryptFlowMedia } from "../lib/flow-media.ts";
import { cdnUrlForKey, getR2Object, putR2Object } from "../modules/cloudflare/r2.ts";
import { uploadMedia } from "../modules/wa-cloud/graph-client.ts";
import {
  ABONO_WHATSAPP_SETTINGS,
  WA_FLOW_SETTINGS,
  loadAbonoStaffNotifyConfig,
  parsePhoneNumberId,
} from "../lib/doctoralia/abono-whatsapp-settings.ts";
import { appendAbonoFlowHistory } from "../lib/doctoralia/abono-flow-history.ts";
import { getSetting } from "../lib/settings.ts";
import type {
  IntakeSubmissionListItemDto,
  listIntakeSubmissionsInputSchema,
} from "@finanzas/orpc-contracts/intake";
import type { z } from "zod";
import { ensureContactAndConversation } from "./wa-contacts.ts";
import { sendFlow } from "./wa-messages.ts";
import { fanout } from "./abono-staff-notify.ts";

// flow_history marker → the auto-send is idempotent (sent once per token).
const INTAKE_FLOW_SENT_STEP = "intake_flow_sent";

type FlowData = Record<string, unknown>;

function str(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

function bool(v: unknown): boolean | null {
  if (typeof v === "boolean") return v;
  const s = str(v)?.toLowerCase();
  if (s == null) return null;
  if (["1", "true", "yes", "si", "sí", "on"].includes(s)) return true;
  if (["0", "false", "no", "off"].includes(s)) return false;
  return null;
}

function insurance(v: unknown): "FONASA" | "ISAPRE" | "PARTICULAR" | null {
  const s = str(v)?.toUpperCase();
  if (s === "FONASA" || s === "ISAPRE" || s === "PARTICULAR") return s;
  return null;
}

function rut(v: unknown): string | null {
  const s = str(v);
  if (!s) return null;
  return validateRut(s) ? normalizeRut(s) : s; // keep raw if invalid, staff verify
}

function birthDate(v: unknown): Date | null {
  const s = str(v);
  if (!s) return null;
  // Flow DatePicker sends epoch-ms string or ISO; tolerate both.
  const asNum = Number(s);
  const d = Number.isFinite(asNum) && s.length >= 10 ? new Date(asNum) : new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

export type MappedIntake = {
  patientName: string;
  patientPhone: string;
  patientEmail: string | null;
  patientRut: string | null;
  patientBirthDate: Date | null;
  healthInsurance: "FONASA" | "ISAPRE" | "PARTICULAR" | null;
  isapreName: string | null;
  address: string | null;
  reason: string | null;
  knownAllergies: string | null;
  conditions: string | null;
  medications: string | null;
  isMinor: boolean | null;
  guardianName: string | null;
  guardianRut: string | null;
  guardianPhone: string | null;
  guardianRelationship: string | null;
};

/** Map the Flow's decrypted `data` to intake fields. `fallback` fills name/phone
 * from the linked payment token when the form omits them. */
export function mapFlowDataToIntake(
  data: FlowData,
  fallback: { patientName?: string; patientPhone?: string }
): MappedIntake {
  return {
    patientName: str(data.nombre) ?? fallback.patientName ?? "",
    patientPhone: str(data.telefono) ?? fallback.patientPhone ?? "",
    patientEmail: str(data.correo),
    patientRut: rut(data.rut),
    patientBirthDate: birthDate(data.fecha_nacimiento),
    healthInsurance: insurance(data.prevision),
    isapreName: str(data.isapre),
    address: str(data.direccion),
    reason: str(data.motivo),
    knownAllergies: str(data.alergias),
    conditions: str(data.condiciones),
    medications: str(data.medicamentos),
    isMinor: bool(data.es_menor),
    guardianName: str(data.tutor_nombre),
    guardianRut: rut(data.tutor_rut),
    guardianPhone: str(data.tutor_telefono),
    guardianRelationship: str(data.tutor_relacion),
  };
}

/**
 * Auto-send the patient-intake Flow to the patient linked to a PENDING abono
 * token. Reusable + idempotent: guarded by a `flow_history` marker so it fires
 * at most once per token.
 *
 * TRIGGER (see wa-cloud-webhook route): we call this when the patient sends
 * their FIRST inbound message in a conversation that has a PENDING
 * AppointmentPaymentToken (matched by phone). This is the ONLY correct moment —
 * interactive Flow messages require an open 24h customer-service window, and a
 * template does NOT open it (only an inbound patient message does). Sending the
 * Flow right after the abono REQUEST template would fail with "window closed".
 *
 * No-op (with a log) when the Flow id isn't configured yet. Does NOT create a
 * Patient — staff still create the record by hand from the forwarded ficha.
 */
export async function sendIntakeFlow(tokenId: string): Promise<void> {
  const [flowIdRaw, bodyTextRaw, phoneIdRaw] = await Promise.all([
    getSetting(WA_FLOW_SETTINGS.intakeFlowId),
    getSetting(WA_FLOW_SETTINGS.intakeBodyText),
    getSetting(ABONO_WHATSAPP_SETTINGS.phoneNumberId),
  ]);
  const flowId = flowIdRaw?.trim();
  if (!flowId) {
    logEvent("wa-flow.intake.autosend_skipped_no_flow_id", { tokenId });
    return;
  }
  const phoneNumberId = parsePhoneNumberId(phoneIdRaw);
  if (phoneNumberId == null) {
    logEvent("wa-flow.intake.autosend_skipped_no_phone", { tokenId });
    return;
  }

  const token = await db.appointmentPaymentToken.findUnique({ where: { id: tokenId } });
  if (!token || token.status !== "PENDING") return;

  // Idempotency guard: don't re-send if we already sent the Flow for this token.
  const history: unknown[] = Array.isArray(token.flowHistory) ? token.flowHistory : [];
  const alreadySent = history.some(
    (e) => (e as { step?: string } | null)?.step === INTAKE_FLOW_SENT_STEP
  );
  if (alreadySent) return;

  const { conversationId } = await ensureContactAndConversation(
    token.patientPhone,
    token.patientName,
    phoneNumberId
  );
  const bodyText =
    bodyTextRaw?.trim() ||
    "Para agilizar tu atención, completa tu ficha de ingreso tocando el botón 📋";
  try {
    await sendFlow(
      {
        conversationId,
        phoneNumberId,
        flowId,
        flowCta: "Completar ficha",
        bodyText,
        flowToken: token.id,
        // Launch on the FICHA screen with name/phone prefilled (the screen
        // declares `data: { nombre, telefono }` → navigate requires them).
        initialScreen: "FICHA",
        initialData: { nombre: token.patientName, telefono: token.patientPhone },
      },
      null
    );
    // Mark BEFORE any further processing so a later re-trigger short-circuits.
    await appendAbonoFlowHistory(token.id, INTAKE_FLOW_SENT_STEP, {});
    logEvent("wa-flow.intake.autosent", { tokenId, flowId });
  } catch (err) {
    // Best-effort: window may have just closed, or Meta hiccup. Staff still get
    // the abono request; the patient can retry by messaging again.
    logError("wa-flow.intake.autosend_failed", err, { tokenId });
  }
}

/** Persist an IntakeSubmission from a flow completion, linked to the payment
 * token via flow_token (= AppointmentPaymentToken.id).
 *
 * Idempotent: Meta retries the data_exchange call (and the client may resubmit
 * after a transient timeout), so we dedup by flowToken — a retry returns the
 * existing row (`isNew: false`) instead of creating a duplicate ficha + firing a
 * second staff notification. Receipt media is NOT processed here (see
 * processIntakeReceipt) so the endpoint can return SUCCESS fast.
 *
 * ponytail: lookup-by-token dedup; Meta retries are sequential (post-timeout),
 * so a race is unlikely. Add a partial unique index on flow_token if concurrent
 * dups ever appear. */
export async function createIntakeFromFlow(
  flowToken: string | null,
  data: FlowData
): Promise<{ id: string; isNew: boolean }> {
  if (flowToken) {
    const existing = await db.intakeSubmission.findFirst({
      where: { flowToken },
      select: { id: true },
    });
    if (existing) {
      logEvent("wa-flow.intake.duplicate_ignored", { flowToken, intakeId: existing.id });
      return { id: existing.id, isNew: false };
    }
  }
  const token = flowToken
    ? await db.appointmentPaymentToken.findUnique({ where: { id: flowToken } })
    : null;
  const mapped = mapFlowDataToIntake(data, {
    patientName: token?.patientName,
    patientPhone: token?.patientPhone,
  });
  const created = await db.intakeSubmission.create({
    data: {
      appointmentPaymentTokenId: token?.id ?? null,
      flowToken,
      sourceChannel: "whatsapp_flow",
      raw: data as never,
      ...mapped,
    },
  });
  logEvent("wa-flow.intake.created", { intakeId: created.id, tokenId: token?.id ?? null });
  return { id: created.id, isNew: true };
}

/** PhotoPicker receipt → download+decrypt+verify → R2. Runs in the background
 * after the endpoint returns SUCCESS (a 10MB CDN download + decrypt + R2 upload
 * would blow Meta's data_exchange timeout). Best-effort: a bad/absent receipt
 * must not lose the intake (staff can still follow up). */
export async function processIntakeReceipt(intakeId: string, data: FlowData): Promise<void> {
  const photo = extractFlowPhoto(data);
  if (!photo) return;
  try {
    const { bytes, mimeType } = await downloadAndDecryptFlowMedia(photo);
    const r2Key = `intake-comprobante/${intakeId}`;
    await putR2Object(r2Key, bytes, mimeType);
    await db.intakeSubmission.update({
      where: { id: intakeId },
      data: { comprobanteR2Key: r2Key, comprobanteMime: mimeType },
    });
    logEvent("wa-flow.intake.comprobante_saved", { intakeId, r2Key });
  } catch (err) {
    logError("wa-flow.intake.comprobante_failed", err, { intakeId });
  }
}

/** Find the PhotoPicker value in a flow payload regardless of the field key —
 * any array whose first element carries encryption_metadata. */
function extractFlowPhoto(data: FlowData): FlowPhoto | null {
  for (const v of Object.values(data)) {
    if (Array.isArray(v)) {
      const first = v[0] as FlowPhoto | undefined;
      if (first?.encryption_metadata && first.cdn_url) return first;
    }
  }
  return null;
}

/** Paginated, newest-first list of intake submissions for the read-only viewer.
 * comprobanteUrl is a CDN url derived from the stored R2 key (null when none). */
export async function listIntakeSubmissions(
  input: z.infer<typeof listIntakeSubmissionsInputSchema>
): Promise<{ items: IntakeSubmissionListItemDto[]; total: number }> {
  const { page, pageSize } = input;
  const [rows, total] = await Promise.all([
    db.intakeSubmission.findMany({
      orderBy: { submittedAt: "desc" },
      skip: page * pageSize,
      take: pageSize,
      include: { appointmentPaymentToken: { select: { appointmentDate: true } } },
    }),
    db.intakeSubmission.count(),
  ]);
  const items: IntakeSubmissionListItemDto[] = rows.map((r) => ({
    id: r.id,
    patientName: r.patientName,
    patientPhone: r.patientPhone,
    patientRut: r.patientRut,
    patientEmail: r.patientEmail,
    healthInsurance: r.healthInsurance,
    isapreName: r.isapreName,
    reason: r.reason,
    isMinor: r.isMinor,
    appointmentDate: r.appointmentPaymentToken?.appointmentDate ?? null,
    comprobanteUrl: r.comprobanteR2Key ? cdnUrlForKey(r.comprobanteR2Key) : null,
    staffNotifiedAt: r.staffNotifiedAt,
    submittedAt: r.submittedAt,
  }));
  return { items, total };
}

/** Forward the intake summary to the clinic staff's WhatsApp so they create the
 * patient record + annotate Doctoralia by hand. Best-effort. */
export async function notifyStaffFicha(intakeId: string): Promise<void> {
  const cfg = await loadAbonoStaffNotifyConfig();
  if (!cfg.enabled || cfg.phones.length === 0 || !cfg.fichaTemplateName) return;
  const intake = await db.intakeSubmission.findUnique({
    where: { id: intakeId },
    include: { appointmentPaymentToken: true },
  });
  if (!intake) return;

  // Template params can't contain newlines (Meta rejects them) → " · " separator.
  const bits: string[] = [];
  if (intake.patientEmail) bits.push(`Correo: ${intake.patientEmail}`);
  if (intake.patientBirthDate) bits.push(`Nac: ${formatChile(intake.patientBirthDate, "D/M/YYYY")}`);
  if (intake.address) bits.push(`Dir: ${intake.address}`);
  if (intake.reason) bits.push(`Motivo: ${intake.reason}`);
  if (intake.knownAllergies) bits.push(`Alergias: ${intake.knownAllergies}`);
  if (intake.conditions) bits.push(`Condiciones: ${intake.conditions}`);
  if (intake.medications) bits.push(`Medicamentos: ${intake.medications}`);
  if (intake.isMinor) {
    bits.push(
      `Tutor: ${[intake.guardianName, intake.guardianRut, intake.guardianPhone].filter(Boolean).join(" ")}`
    );
  }
  // Collapse newlines/whitespace — WhatsApp rejects template params containing
  // newlines, and TextArea fields (motivo/alergias/…) carry them.
  const detalle = bits.join(" · ").replace(/\s+/g, " ").trim() || "—";
  const fecha = intake.appointmentPaymentToken
    ? formatChile(intake.appointmentPaymentToken.appointmentDate, "dddd D [de] MMMM HH:mm")
    : "—";
  const prevision = intake.healthInsurance
    ? `${intake.healthInsurance}${intake.isapreName ? ` · ${intake.isapreName}` : ""}`
    : "—";

  // Forward the receipt as the template's IMAGE header. Re-upload to Meta under
  // the sending phone (a media id is scoped to its phone). Best-effort.
  let imageHeaderMediaId: string | undefined;
  if (intake.comprobanteR2Key && cfg.phoneNumberId != null) {
    try {
      const obj = await getR2Object(intake.comprobanteR2Key);
      const bytes = Buffer.from(await new Response(obj.body).arrayBuffer());
      const mime = intake.comprobanteMime ?? obj.contentType;
      const uploaded = await uploadMedia(
        cfg.phoneNumberId,
        new Blob([bytes] as BlobPart[], { type: mime }),
        mime,
        "comprobante"
      );
      imageHeaderMediaId = uploaded.id;
    } catch (err) {
      logError("wa-flow.intake.staff_header_failed", err, { intakeId });
    }
  }

  const sent = await fanout(
    cfg,
    cfg.fichaTemplateName,
    [
      { name: "paciente", text: intake.patientName },
      { name: "rut", text: intake.patientRut ?? "—" },
      { name: "prevision", text: prevision },
      { name: "fecha", text: fecha },
      { name: "detalle", text: detalle.slice(0, 1000) },
    ],
    imageHeaderMediaId
  );
  await db.intakeSubmission.update({
    where: { id: intakeId },
    data: { staffNotifiedAt: new Date() },
  });
  logEvent("wa-flow.intake.staff_notified", { intakeId, sent });
}
