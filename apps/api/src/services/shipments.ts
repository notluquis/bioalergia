import { db } from "@finanzas/db";
import type { createShipmentInputSchema, shipmentSchema } from "@finanzas/orpc-contracts/shipments";
import { Decimal } from "decimal.js";

// El row de findMany ahora trae todos los campos (cliente sin colapsar), pero
// el shape de SerializedShipment diverge del contrato Zod en tipos de fecha
// (Date↔string/unknown) — no es un tema de rows lossy. El contrato es la
// autoridad del API, así que SerializedShipment = z.infer<shipmentSchema> y
// serializeShipment castea (el runtime cumple el shape).
type ShipmentRow = Awaited<ReturnType<typeof db.shipment.findMany>>[number];
type SerializedShipment = z.infer<typeof shipmentSchema>;

function serializeShipment(s: ShipmentRow): SerializedShipment {
  return {
    ...s,
    cashOnDelivery: Number(s.cashOnDelivery),
    declaredValue: Number(s.declaredValue),
    weight: Number(s.weight),
    height: Number(s.height),
    width: Number(s.width),
    length: Number(s.length),
    additionalServicesCost: Number(s.additionalServicesCost ?? 0),
  } as SerializedShipment;
}
import { chilexpressConfig } from "../lib/config.ts";
import { deleteSetting, getSetting, loadSettings, updateSetting } from "../lib/settings.ts";
import {
  createTransportOrder,
  closeCertificate,
  createCertificate,
  friendlyChilexpressError,
  georeferenceAddress,
  getCertificate,
  getCommercialOffices,
  getCommunes,
  getNearbyOffices,
  getRegions,
  getStreetNumbers,
  quoteCourier,
  reprintLabel,
  searchStreets,
  trackTransportOrder,
} from "../modules/chilexpress/client.ts";
import type { z } from "zod";

export type CreateShipmentInput = z.infer<typeof createShipmentInputSchema>;

function requireCxConfig() {
  if (!chilexpressConfig) {
    throw new Error(
      "ChileExpress no configurado. Falta CHILEXPRESS_API_KEY, CHILEXPRESS_TCC o CHILEXPRESS_ORIGIN_COVERAGE_CODE"
    );
  }
  return chilexpressConfig;
}

export async function fetchRegions() {
  const cfg = requireCxConfig();
  return getRegions(cfg);
}

export async function fetchCommunes(regionId: string, type: 1 | 2 = 1) {
  const cfg = requireCxConfig();
  return getCommunes(cfg, regionId, type);
}

export async function fetchCommercialOffices(options: {
  regionCode: string;
  countyName: string;
  type?: 0 | 4;
}) {
  const cfg = requireCxConfig();
  return getCommercialOffices(cfg, options);
}

export async function fetchNearbyOffices(addressId: number) {
  const cfg = requireCxConfig();
  return getNearbyOffices(cfg, addressId);
}

export async function fetchStreets(options: { countyName: string; query: string }) {
  const cfg = requireCxConfig();
  return searchStreets(cfg, options);
}

export async function fetchStreetNumbers(streetNameId: number) {
  const cfg = requireCxConfig();
  return getStreetNumbers(cfg, streetNameId);
}

export async function geocodeAddress(input: {
  streetName: string;
  countyName: string;
  number: string;
}) {
  const cfg = requireCxConfig();
  return georeferenceAddress(cfg, input);
}

export async function reprintShipmentLabel(shipmentId: number) {
  const cfg = requireCxConfig();
  const shipment = await db.shipment.findUnique({ where: { id: shipmentId } });
  if (!shipment) throw new Error("Shipment no encontrado");
  const result = await reprintLabel(cfg, {
    transportOrderNumber: shipment.otNumber,
    labelType: shipment.labelType ?? 2,
  });
  if (result.label) {
    await db.shipment.update({
      where: { id: shipmentId },
      data: { labelBase64: result.label, barcode: result.barcode ?? shipment.barcode },
    });
  }
  return result;
}

export async function refreshShipmentTracking(shipmentId: number) {
  const cfg = requireCxConfig();
  const shipment = await db.shipment.findUnique({ where: { id: shipmentId } });
  if (!shipment) throw new Error("Shipment no encontrado");
  // Spec /tracking exige transportOrderNumber + reference + rut + showTrackingEvents.
  // shipment.reference es el deliveryReference que mandamos al crear la OT;
  // companyRut viene de la env CHILEXPRESS_COMPANY_RUT (en sandbox = 96756430).
  const tracking = await trackTransportOrder(cfg, {
    transportOrderNumber: shipment.otNumber,
    reference: shipment.reference ?? undefined,
    rut: cfg.companyRut,
    showTrackingEvents: 1,
  });
  await db.shipment.update({
    where: { id: shipmentId },
    data: {
      trackingStatus: tracking.status ?? tracking.statusDescription ?? null,
      trackingUpdatedAt: new Date(),
    },
  });
  return tracking;
}

// ─── Manifiesto (certificado de transporte del día) ──────────────────────────
//
// El certificado activo se persiste como Setting KV (no requiere migración).
// Mientras hay uno abierto, cada OT creada referencia su certificateNumber en
// el header → quedan agrupadas en ese manifiesto. Al cerrar se limpia el KV y
// se obtiene el PDF.
const ACTIVE_CERT_KEY = "shipments.activeCertificate";

type ActiveManifest = { certificateNumber: string; openedAt: string };

/** Lee el certificado actualmente abierto desde el Setting KV (o null). */
export async function getActiveManifest(): Promise<ActiveManifest | null> {
  const raw = await getSetting(ACTIVE_CERT_KEY);
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (
      parsed &&
      typeof parsed === "object" &&
      "certificateNumber" in parsed &&
      typeof (parsed as ActiveManifest).certificateNumber === "string"
    ) {
      return parsed as ActiveManifest;
    }
  } catch {
    // KV corrupto → tratar como sin manifiesto activo.
  }
  return null;
}

/**
 * Abre el manifiesto del día: si ya hay uno activo lo devuelve (idempotente),
 * si no crea un certificado en Chilexpress y lo persiste. Las OTs creadas
 * mientras esté abierto referencian su certificateNumber en el header.
 */
export async function openShipmentCertificate() {
  const cfg = requireCxConfig();
  const existing = await getActiveManifest();
  if (existing) {
    return { ...existing, alreadyOpen: true as const };
  }
  const result = await createCertificate(cfg, cfg.clientRut);
  const openedAt = new Date().toISOString();
  await updateSetting(
    ACTIVE_CERT_KEY,
    JSON.stringify({ certificateNumber: result.certificateNumber, openedAt })
  );
  return {
    certificateNumber: result.certificateNumber,
    statusDescription: result.statusDescription,
    openedAt,
    alreadyOpen: false as const,
  };
}

/**
 * Cierra el manifiesto y devuelve el PDF (base64) + detalle por
 * producto/servicio. Operación de fin-de-día: una vez cerrado, las OTs
 * asociadas no se pueden alterar. Si no se pasa certificateNumber se usa el
 * manifiesto activo. Limpia el KV para que las próximas OTs no lo referencien.
 */
export async function closeShipmentCertificate(input: {
  certificateNumber?: string | number;
  certificateType?: 1 | 2;
  dropNumber?: number;
}) {
  const cfg = requireCxConfig();
  const active = await getActiveManifest();
  const certificateNumber = input.certificateNumber ?? active?.certificateNumber;
  if (certificateNumber == null) {
    throw new Error("No hay manifiesto activo para cerrar");
  }
  const result = await closeCertificate(cfg, {
    certificateNumber,
    certificateType: input.certificateType,
    dropNumber: input.dropNumber,
  });
  // Solo limpiar el KV si cerramos el que estaba activo.
  if (active && String(active.certificateNumber) === String(certificateNumber)) {
    await deleteSetting(ACTIVE_CERT_KEY);
  }
  return result;
}

/** Reconsulta un certificado cerrado para obtener su PDF (base64) y detalle. */
export async function getShipmentCertificate(certificateNumber: string | number) {
  const cfg = requireCxConfig();
  return getCertificate(cfg, certificateNumber);
}

export async function quoteShipment(input: {
  originCoverageCode: string;
  destinationCoverageCode: string;
  weight: number;
  height: number;
  width: number;
  length: number;
  declaredValue: number;
}) {
  const cfg = requireCxConfig();
  const response = await quoteCourier(cfg, {
    originCountyCode: input.originCoverageCode,
    destinationCountyCode: input.destinationCoverageCode,
    package: {
      weight: input.weight,
      height: input.height,
      width: input.width,
      length: input.length,
    },
    productType: 3,
    contentType: 1,
    declaredWorth: String(Math.round(input.declaredValue)),
    deliveryTime: 0,
    // Pasar la TCC enruta a /rates/business → la respuesta trae
    // `serviceValueDiscount` con el precio rebajado por contrato de empresa.
    // Caer al cotizador estándar solo si la cuenta no tiene TCC configurada.
    customerCardNumber: cfg.clientRut || undefined,
  });

  const services = response.data?.courierServiceOptions ?? [];
  // Chilexpress devuelve tipos mixtos (string|number, "true"/"1"/bool) según
  // tier y env. Normalizar al shape del contrato (cxServiceOptionSchema) acá,
  // en el boundary, para que el output validator no caiga y el wizard reciba
  // tipos limpios. Si la respuesta vino de /rates/business, usar
  // serviceValueDiscount (precio efectivo a cobrar) en vez de serviceValue.
  return services.map((s) => {
    const effectiveValue =
      s.serviceValueDiscount != null && s.serviceValueDiscount !== ""
        ? s.serviceValueDiscount
        : s.serviceValue;
    return {
      serviceTypeCode: String(s.serviceTypeCode),
      serviceDescription: s.serviceDescription,
      serviceValue: Number(effectiveValue),
      deliveryTime: s.deliveryTime,
      didUseVolumetricWeight: coerceBool(s.didUseVolumetricWeight),
      finalWeight: s.finalWeight == null ? undefined : Number(s.finalWeight),
      conditions: s.conditions,
      deliveryType: s.deliveryType,
    };
  });
}

/** Chilexpress manda bool como `true`/`false` o "true"/"1"/"0". Normalizar. */
function coerceBool(value: boolean | string | undefined): boolean | undefined {
  if (value == null) return undefined;
  if (typeof value === "boolean") return value;
  return value === "true" || value === "1";
}

export async function createShipment(input: CreateShipmentInput) {
  const cfg = requireCxConfig();

  // Resolve delivery payload based on chosen mode. Single shape so TS
  // doesn't try to union two narrowed literals into the contract type.
  let streetName: string;
  let streetNumber: string;
  let supplement: string;
  let coverageRegionCode: string;
  let deliveryOnCommercialOffice: boolean;
  let commercialOfficeId: string;
  let observation: string;
  if (input.deliveryMode === "home") {
    if (!input.addressId) {
      throw new Error("Para despacho a domicilio se requiere addressId");
    }
    const address = await db.address.findUnique({ where: { id: input.addressId } });
    if (!address) {
      throw new Error("Dirección no encontrada");
    }
    if (!address.coverageCode) {
      throw new Error(
        "La dirección guardada no tiene coverageCode de Chilexpress; vuelve a editarla y selecciona la comuna"
      );
    }
    streetName = address.street;
    streetNumber = address.number;
    supplement = address.supplement ?? "";
    coverageRegionCode = address.coverageCode;
    deliveryOnCommercialOffice = false;
    commercialOfficeId = "";
    observation = address.reference ?? "";
  } else {
    if (!input.commercialOfficeId) {
      throw new Error("Para despacho a sucursal se requiere commercialOfficeId");
    }
    streetName = "A sucursal";
    streetNumber = "0";
    supplement = "";
    coverageRegionCode = input.destinationCoverageCode;
    deliveryOnCommercialOffice = true;
    commercialOfficeId = input.commercialOfficeId;
    observation = "";
  }
  const deliveryAddress = {
    countyCoverageCode: coverageRegionCode,
    streetName,
    streetNumber,
    supplement,
    addressType: "Dest" as const,
    deliveryOnCommercialOffice,
    commercialOfficeId,
    observation,
  };

  // Si hay un manifiesto abierto, la OT lo referencia para quedar agrupada.
  // Sin manifiesto activo se manda 0 (OT suelta, comportamiento legacy).
  const activeManifest = await getActiveManifest();
  const headerCertificateNumber = activeManifest ? Number(activeManifest.certificateNumber) : 0;

  // Chilexpress exige contacto destinatario (D) Y remitente (R). El remitente
  // es la clínica: tomamos nombre/teléfono/correo de Settings (con fallback).
  const brand = await loadSettings();
  const senderName = brand.orgName || "Bioalergia";
  const senderPhone = (brand.orgPhone || "").replace(/\D/g, "") || "000000000";
  const senderMail = brand.supportEmail || "contacto@bioalergia.cl";

  // Referencia única del envío (deliveryReference == groupReference para un
  // solo bulto). Calcularla UNA vez: con dos Date.now() podían diferir por 1ms.
  // Chilexpress la retorna en tracking + cierre de certificado.
  const shipmentRef = `BIO-${input.patientId}-${Math.floor(Date.now() / 1000)}`;

  const response = await createTransportOrder(cfg, {
    header: {
      certificateNumber: Number.isFinite(headerCertificateNumber) ? headerCertificateNumber : 0,
      customerCardNumber: cfg.clientRut,
      countyOfOriginCoverageCode: cfg.originCoverageCode,
      labelType: 2,
    },
    details: [
      {
        // ChileExpress espera arrays (IList<TransportOrderAddress/Contact>),
        // no objetos con keys nombradas — devolvía 400 "requires a JSON array".
        addresses: [deliveryAddress],
        contacts: [
          {
            name: input.recipientName,
            phoneNumber: input.recipientPhone,
            mail: input.recipientEmail ?? "",
            contactType: "D" as const,
          },
          {
            // Remitente (R) — la clínica. Spec lo marca obligatorio junto al D.
            name: senderName,
            phoneNumber: senderPhone,
            mail: senderMail,
            contactType: "R" as const,
          },
        ],
        packages: [
          {
            // Spec (Package): weight/height/width/length como string con punto.
            weight: String(input.weight),
            height: String(input.height),
            width: String(input.width),
            length: String(input.length),
            // Código del servicio elegido en cotización (3=EXPRESS, etc).
            serviceDeliveryCode: input.serviceTypeCode,
            // productCode: 1 = Documento, 3 = Encomienda. Antes "2" (inválido).
            productCode: "3",
            // deliveryReference y groupReference obligatorios (spec). Mismo valor
            // para envío de un solo bulto. Chilexpress los retorna en tracking +
            // cierre de certificado para conciliar con nuestra DB.
            deliveryReference: shipmentRef,
            groupReference: shipmentRef,
            declaredValue: String(Math.round(input.declaredValue)),
            // declaredContent: 1 Personales, 2 Educación, 4 Vestuario, 5 Otros,
            // 7 Tecnología. Inmunoterapia → "Otros".
            declaredContent: "5",
            // receivableAmountInDelivery: monto a cobrar contra entrega (COD).
            // Solo si > 0; inmunoterapia normalmente es prepagada.
            ...(input.cashOnDelivery > 0
              ? { receivableAmountInDelivery: Math.round(input.cashOnDelivery) }
              : {}),
            ...(input.additionalServiceCodes && input.additionalServiceCodes.length > 0
              ? {
                  additionalServices: input.additionalServiceCodes.map((c) => ({
                    serviceTypeCode: c,
                  })),
                }
              : {}),
          },
        ],
      },
    ],
  });

  const result = response.data?.detail?.[0];
  if (!result?.transportOrderNumber) {
    // Chilexpress devuelve 200 OK con el motivo real a NIVEL DE DETALLE
    // (response.data.detail[i].statusDescription); el statusDescription
    // top-level solo dice "ninguno de los detalles fue exitoso". Preferir
    // el del detalle, que es accionable (cobertura inválida, servicio no
    // habilitado para el destino, peso/dimensión fuera de rango, etc).
    const detailReason = response.data?.detail?.[0]?.statusDescription;
    const topReason = response.statusDescription ?? response.message;
    const raw = detailReason ?? topReason ?? "sin detalles";
    // Log estructurado de la respuesta completa: bug prod-only, sin esto no
    // hay forma de saber qué detalle rechazó Chilexpress (regla logs-first).
    console.error(
      "[shipments.createOT.failed]",
      JSON.stringify({
        topStatusCode: response.statusCode,
        topStatusDescription: topReason,
        detail: response.data?.detail,
        sentHeaderCertificate: headerCertificateNumber,
        coverageCode: input.destinationCoverageCode,
        serviceTypeCode: input.serviceTypeCode,
      })
    );
    const friendly = friendlyChilexpressError(
      200,
      JSON.stringify({ statusDescription: raw, statusCode: response.statusCode })
    );
    throw new Error(friendly ?? `ChileExpress no generó la OT: ${raw}`);
  }

  const otNumber = result.transportOrderNumber;
  const labelBase64 = result.label?.labelData ?? null;

  const shipment = await db.shipment.create({
    data: {
      patientId: input.patientId,
      otNumber,
      serviceTypeCode: input.serviceTypeCode,
      serviceDescription: input.serviceDescription,
      serviceFullDesc: result.serviceDescriptionFull ?? null,
      cashOnDelivery: new Decimal(input.cashOnDelivery),
      declaredValue: new Decimal(input.declaredValue),
      weight: new Decimal(input.weight),
      height: new Decimal(input.height),
      width: new Decimal(input.width),
      length: new Decimal(input.length),
      recipientName: input.recipientName,
      recipientPhone: input.recipientPhone,
      recipientEmail: input.recipientEmail ?? null,
      commercialOfficeId: input.commercialOfficeId ?? "",
      commercialOfficeName: input.commercialOfficeName ?? "",
      coverageCode: input.destinationCoverageCode,
      contentDescription: input.contentDescription,
      certificateNumber: response.data?.header?.certificateNumber ?? null,
      reference: result.reference ?? null,
      barcode: result.barcode ?? null,
      labelBase64,
      labelType: result.label?.labelType ?? null,
      additionalServiceCodes: input.additionalServiceCodes ?? [],
      additionalServicesCost: new Decimal(input.additionalServicesCost ?? 0),
      status: "CREATED",
    },
  });

  return {
    shipment: serializeShipment(shipment),
    otNumber,
    barcode: result.barcode ?? null,
    certificateNumber: response.data?.header?.certificateNumber ?? null,
    labelBase64,
  };
}

export async function listShipmentsByPatient(patientId: number) {
  const shipments = await db.shipment.findMany({
    where: { patientId },
    orderBy: { createdAt: "desc" },
  });
  return shipments.map(serializeShipment);
}

export async function listAllShipments() {
  const shipments = await db.shipment.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      patient: {
        include: { person: { select: { names: true, fatherName: true, rut: true } } },
      },
    },
  });
  return shipments.map((s) => ({
    ...serializeShipment(s),
    patientName: `${s.patient.person.names} ${s.patient.person.fatherName}`.trim(),
    patientRut: s.patient.person.rut,
  }));
}
