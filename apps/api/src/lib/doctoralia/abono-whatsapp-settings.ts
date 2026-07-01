import { db } from "@finanzas/db";
import { getSetting } from "../settings.ts";

export const ABONO_WHATSAPP_SETTINGS = {
  requestEnabled: "doctoralia.abono.whatsapp.request.enabled",
  confirmationEnabled: "doctoralia.abono.whatsapp.confirmation.enabled",
  phoneNumberId: "doctoralia.abono.whatsapp.phoneNumberId",
  requestTemplateName: "doctoralia.abono.whatsapp.requestTemplateName",
  requestTemplateLanguage: "doctoralia.abono.whatsapp.requestTemplateLanguage",
  confirmationTemplatePrefix: "doctoralia.abono.whatsapp.confirmationTemplatePrefix",
  confirmationTemplateLanguage: "doctoralia.abono.whatsapp.confirmationTemplateLanguage",
} as const;

export const ABONO_PAYMENT_SETTINGS = {
  fonasaFullAmountClp: "doctoralia.abono.amount.fonasaClp",
  particularFullAmountClp: "doctoralia.abono.amount.particularClp",
  expirationDays: "doctoralia.abono.expirationDays",
  publicBaseUrl: "site.publicBaseUrl",
  statementDescriptor: "doctoralia.abono.mercadopago.statementDescriptor",
} as const;

// Clinic location for the WhatsApp template LOCATION header, read from the
// ClinicSettings singleton (DB) — name + address + lat/lng. Returns null when
// coordinates aren't set yet, so the send skips the header instead of failing.
export async function loadClinicLocation(): Promise<{
  latitude: string;
  longitude: string;
  name: string;
  address: string;
} | null> {
  const c = await db.clinicSettings.findUnique({ where: { id: 1 } });
  if (!c?.latitude || !c?.longitude) return null;
  return {
    latitude: c.latitude.toString(),
    longitude: c.longitude.toString(),
    name: c.name,
    address: c.address,
  };
}

// Clinic address (DB single source) for templates that show it as a body var
// instead of a location header. Returns "" when unset (template var tolerates it).
export async function loadClinicAddress(): Promise<string> {
  const c = await db.clinicSettings.findUnique({ where: { id: 1 } });
  return c?.address ?? "";
}

export type AbonoWhatsappNotice = "request" | "confirmation";

export type AbonoWhatsappConfig = {
  enabled: boolean;
  language: string | null;
  phoneNumberId: number | null;
  templateName: string | null;
};

export type AbonoPaymentSettings = {
  expirationDays: number;
  fonasaFullAmountClp: number;
  particularFullAmountClp: number;
  publicBaseUrl: string;
  statementDescriptor: string | null;
};

export type AbonoPricingSettings = Pick<
  AbonoPaymentSettings,
  "fonasaFullAmountClp" | "particularFullAmountClp"
>;

function parseEnabled(raw: string | null): boolean {
  if (raw == null || raw.trim() === "") return false;
  const value = raw.trim().toLowerCase();
  if (["0", "false", "no", "off"].includes(value)) return false;
  if (["1", "true", "yes", "on"].includes(value)) return true;
  return false;
}

export function parsePhoneNumberId(raw: string | null): number | null {
  const trimmed = raw?.trim();
  if (!trimmed) return null;
  if (!/^\d+$/.test(trimmed)) return null;

  const value = Number.parseInt(trimmed, 10);
  return Number.isSafeInteger(value) && value > 0 ? value : null;
}

function requirePositiveInt(raw: string | null, key: string): number {
  const trimmed = raw?.trim();
  const value = trimmed && /^\d+$/.test(trimmed) ? Number.parseInt(trimmed, 10) : Number.NaN;
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`Setting ${key} debe ser un entero positivo`);
  }
  return value;
}

function requireUrl(raw: string | null, key: string): string {
  const value = raw?.trim();
  if (!value) throw new Error(`Setting ${key} requerido`);
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`Setting ${key} debe ser una URL válida`);
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error(`Setting ${key} debe usar http o https`);
  }
  return value.replace(/\/+$/, "");
}

export async function loadAbonoWhatsappConfig(
  notice: AbonoWhatsappNotice
): Promise<AbonoWhatsappConfig> {
  const [enabledRaw, phoneRaw, templateRaw, languageRaw] = await Promise.all([
    getSetting(
      notice === "request"
        ? ABONO_WHATSAPP_SETTINGS.requestEnabled
        : ABONO_WHATSAPP_SETTINGS.confirmationEnabled
    ),
    getSetting(ABONO_WHATSAPP_SETTINGS.phoneNumberId),
    getSetting(
      notice === "request"
        ? ABONO_WHATSAPP_SETTINGS.requestTemplateName
        : ABONO_WHATSAPP_SETTINGS.confirmationTemplatePrefix
    ),
    getSetting(
      notice === "request"
        ? ABONO_WHATSAPP_SETTINGS.requestTemplateLanguage
        : ABONO_WHATSAPP_SETTINGS.confirmationTemplateLanguage
    ),
  ]);

  const phoneNumberId = parsePhoneNumberId(phoneRaw);

  return {
    enabled: parseEnabled(enabledRaw),
    language: languageRaw?.trim() || null,
    phoneNumberId,
    templateName: templateRaw?.trim() || null,
  };
}

export async function findAbonoWhatsappPhone(
  config: AbonoWhatsappConfig
): Promise<Awaited<ReturnType<typeof db.waPhoneNumber.findFirst>>> {
  if (config.phoneNumberId == null) return null;

  return await db.waPhoneNumber.findFirst({
    where: { id: config.phoneNumberId, active: true },
  });
}

export async function loadAbonoPaymentSettings(): Promise<AbonoPaymentSettings> {
  const [pricing, expirationRaw, publicBaseUrlRaw, statementDescriptorRaw] = await Promise.all([
    loadAbonoPricingSettings(),
    getSetting(ABONO_PAYMENT_SETTINGS.expirationDays),
    getSetting(ABONO_PAYMENT_SETTINGS.publicBaseUrl),
    getSetting(ABONO_PAYMENT_SETTINGS.statementDescriptor),
  ]);

  return {
    expirationDays: requirePositiveInt(expirationRaw, ABONO_PAYMENT_SETTINGS.expirationDays),
    ...pricing,
    publicBaseUrl: requireUrl(publicBaseUrlRaw, ABONO_PAYMENT_SETTINGS.publicBaseUrl),
    statementDescriptor: statementDescriptorRaw?.trim() || null,
  };
}

export async function loadAbonoPricingSettings(): Promise<AbonoPricingSettings> {
  const [fonasaRaw, particularRaw] = await Promise.all([
    getSetting(ABONO_PAYMENT_SETTINGS.fonasaFullAmountClp),
    getSetting(ABONO_PAYMENT_SETTINGS.particularFullAmountClp),
  ]);

  return {
    fonasaFullAmountClp: requirePositiveInt(
      fonasaRaw,
      ABONO_PAYMENT_SETTINGS.fonasaFullAmountClp
    ),
    particularFullAmountClp: requirePositiveInt(
      particularRaw,
      ABONO_PAYMENT_SETTINGS.particularFullAmountClp
    ),
  };
}

// Staff WhatsApp notification: the receptionists ("las chiquillas") work from
// the clinic's WhatsApp phones (NOT the intranet), so we ping each of their
// numbers from the Cloud number when a payment lands. Reuses the same sender
// phoneNumberId as the abono request. Templates are UTILITY (sent any time).
export const ABONO_STAFF_NOTIFY_SETTINGS = {
  enabled: "doctoralia.abono.staffNotify.enabled",
  phones: "doctoralia.abono.staffNotify.phones",
  cardTemplateName: "doctoralia.abono.staffNotify.cardTemplateName",
  comprobanteTemplateName: "doctoralia.abono.staffNotify.comprobanteTemplateName",
  fichaTemplateName: "doctoralia.abono.staffNotify.fichaTemplateName",
  templateLanguage: "doctoralia.abono.staffNotify.templateLanguage",
} as const;

export type AbonoStaffNotifyConfig = {
  enabled: boolean;
  phones: string[];
  cardTemplateName: string | null;
  comprobanteTemplateName: string | null;
  fichaTemplateName: string | null;
  language: string | null;
  phoneNumberId: number | null;
};

export async function loadAbonoStaffNotifyConfig(): Promise<AbonoStaffNotifyConfig> {
  const [enabledRaw, phonesRaw, cardRaw, compRaw, fichaRaw, langRaw, phoneIdRaw] =
    await Promise.all([
      getSetting(ABONO_STAFF_NOTIFY_SETTINGS.enabled),
      getSetting(ABONO_STAFF_NOTIFY_SETTINGS.phones),
      getSetting(ABONO_STAFF_NOTIFY_SETTINGS.cardTemplateName),
      getSetting(ABONO_STAFF_NOTIFY_SETTINGS.comprobanteTemplateName),
      getSetting(ABONO_STAFF_NOTIFY_SETTINGS.fichaTemplateName),
      getSetting(ABONO_STAFF_NOTIFY_SETTINGS.templateLanguage),
      getSetting(ABONO_WHATSAPP_SETTINGS.phoneNumberId),
    ]);
  // Accept comma/space/semicolon separated E.164; normalize a leading +.
  const phones = (phonesRaw ?? "")
    .split(/[\s,;]+/)
    .map((p) => p.trim())
    .filter((p) => /^\+?\d{8,15}$/.test(p))
    .map((p) => (p.startsWith("+") ? p : `+${p}`));
  return {
    enabled: parseEnabled(enabledRaw),
    phones,
    cardTemplateName: cardRaw?.trim() || null,
    comprobanteTemplateName: compRaw?.trim() || null,
    fichaTemplateName: fichaRaw?.trim() || null,
    language: langRaw?.trim() || null,
    phoneNumberId: parsePhoneNumberId(phoneIdRaw),
  };
}
