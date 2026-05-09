import type { Shipment } from "@finanzas/db";
import { db } from "@finanzas/db";
import { Decimal } from "decimal.js";

type SerializedShipment = Omit<
  Shipment,
  "cashOnDelivery" | "declaredValue" | "weight" | "height" | "width" | "length"
> & {
  cashOnDelivery: number;
  declaredValue: number;
  weight: number;
  height: number;
  width: number;
  length: number;
};

function serializeShipment(s: Shipment): SerializedShipment {
  return {
    ...s,
    cashOnDelivery: Number(s.cashOnDelivery),
    declaredValue: Number(s.declaredValue),
    weight: Number(s.weight),
    height: Number(s.height),
    width: Number(s.width),
    length: Number(s.length),
  };
}
import { chilexpressConfig } from "../config";
import {
  createTransportOrder,
  getCommercialOffices,
  getCommunes,
  getRegions,
  quoteCourier,
} from "../modules/chilexpress/client";
import type { CreateShipmentInput } from "../orpc/shipments";

function requireCxConfig() {
  if (!chilexpressConfig) {
    throw new Error("ChileExpress no configurado. Falta CHILEXPRESS_API_KEY, CHILEXPRESS_TCC o CHILEXPRESS_ORIGIN_COVERAGE_CODE");
  }
  return chilexpressConfig;
}

export async function fetchRegions() {
  const cfg = requireCxConfig();
  return getRegions(cfg);
}

export async function fetchCommunes(regionId: string) {
  const cfg = requireCxConfig();
  return getCommunes(cfg, regionId);
}

export async function fetchCommercialOffices(coverageRegionCode: string) {
  const cfg = requireCxConfig();
  return getCommercialOffices(cfg, coverageRegionCode);
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
  });

  return response.data?.courierServiceOptions ?? [];
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
        "La dirección guardada no tiene coverageCode de Chilexpress; vuelve a editarla y selecciona la comuna",
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
    streetName,
    streetNumber,
    supplement,
    county: { coverageRegionCode },
    isOrigin: false as const,
    deliveryOnCommercialOffice,
    commercialOfficeId,
    observation,
  };

  const response = await createTransportOrder(cfg, {
    header: {
      certificateNumber: 0,
      clientRut: cfg.clientRut,
      countyOfOriginCoverageCode: cfg.originCoverageCode,
      labelType: 2,
    },
    details: [
      {
        addresses: {
          deliveryAddress,
        },
        contacts: {
          recipient: {
            name: input.recipientName,
            phoneNumber: input.recipientPhone,
            mail: input.recipientEmail ?? "",
          },
        },
        packages: [
          {
            weight: input.weight,
            height: input.height,
            width: input.width,
            length: input.length,
            serviceDeliveryCode: input.serviceTypeCode,
            declaredValue: String(Math.round(input.declaredValue)),
            cashOnDelivery: String(Math.round(input.cashOnDelivery)),
            descriptionOfContent: input.contentDescription,
            productCode: "2",
            multivariateCode: input.serviceTypeCode,
            numberOfPackages: 1,
          },
        ],
      },
    ],
  });

  const result = response.data?.operationDetails?.[0];
  if (!result?.otNumber) {
    throw new Error(
      `ChileExpress no devolvió OT. Mensaje: ${response.message ?? "sin detalles"}`,
    );
  }

  const shipment = await db.shipment.create({
    data: {
      patientId: input.patientId,
      otNumber: result.otNumber,
      serviceTypeCode: input.serviceTypeCode,
      serviceDescription: input.serviceDescription,
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
      labelBase64: result.labelData ?? null,
      status: "CREATED",
    },
  });

  return {
    shipment: serializeShipment(shipment),
    otNumber: result.otNumber,
    labelBase64: result.labelData ?? null,
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
