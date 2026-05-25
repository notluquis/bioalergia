import { dbClinicalSeries as db } from "@finanzas/db/slices";

import { buildSeriesDisplayName, computeExpectedSessions } from "./classification/display.ts";
import { inferAllergenType, inferVaccineProduct } from "./classification/allergens.ts";
import { inferDeliveryModality } from "./classification/delivery.ts";
import { inferHealthInsurance } from "./classification/insurance.ts";
import { extractSeriesPhones } from "./extraction/phones.ts";
import { choosePreferredIdentityName } from "./identity-naming/group-key.ts";
import {
  selectRepresentativeClinicalIdentity,
  shouldPromoteBeneficiaryToPatientIdentity,
} from "./identity-naming/representative.ts";
import { upgradePatientNameFromDte } from "./identity-naming/upgrade.ts";
import type { ClinicalSeriesKind } from "./types.ts";

export async function refreshClinicalSeriesMetadata(seriesId: number): Promise<void> {
  const series = await db.clinicalSeries.findUnique({
    where: { id: seriesId },
    include: {
      events: {
        select: {
          amountExpected: true,
          amountPaid: true,
          description: true,
          seriesStageKind: true,
          seriesStageNumber: true,
          startDate: true,
          startDateTime: true,
          summary: true,
        },
      },
    },
  });

  if (!series) {
    return;
  }

  // Always re-extract from event text so an improved algorithm
  // overwrites stale stored values. When there is usable text, choose
  // the dominant identity across the whole series instead of trusting
  // the first non-null event.
  let { patientName, patientRut, beneficiaryName, beneficiaryRut } =
    selectRepresentativeClinicalIdentity(series.events, {
      beneficiaryName: series.beneficiaryName,
      beneficiaryRut: series.beneficiaryRut,
      patientName: series.patientName,
      patientRut: series.patientRut,
    });

  // Upgrade patientName from DTE when the DTE clientRUT matches
  // patientRut and the clientName is a more complete version of the
  // current name (e.g. calendar has "villegas krausse" but the DTE
  // has "JULIO RODRIGO VILLEGAS KRAUSE").
  if (patientRut) {
    const dteByPatientRut = await db.$queryRaw<Array<{ clientName: string; clientRUT: string }>>`
      SELECT DISTINCT s.client_name AS "clientName", s.client_rut AS "clientRUT"
      FROM dte_sale_details s
      WHERE s.client_rut = ${patientRut}
      LIMIT 5
    `;

    if (dteByPatientRut.length > 0) {
      const upgraded = upgradePatientNameFromDte(patientName, dteByPatientRut);
      if (upgraded) patientName = upgraded;
    }
  }

  // When there is no patientRut but the beneficiaryRut matches a DTE,
  // upgrade the beneficiary name and promote beneficiary → patient
  // (since the beneficiary is effectively the patient in this case).
  if (!patientRut && beneficiaryRut) {
    const dteByBeneficiaryRut = await db.$queryRaw<
      Array<{ clientName: string; clientRUT: string }>
    >`
      SELECT DISTINCT s.client_name AS "clientName", s.client_rut AS "clientRUT"
      FROM dte_sale_details s
      WHERE s.client_rut = ${beneficiaryRut}
      LIMIT 5
    `;

    if (dteByBeneficiaryRut.length > 0) {
      const upgradedBenef = upgradePatientNameFromDte(beneficiaryName, dteByBeneficiaryRut);
      if (upgradedBenef) beneficiaryName = upgradedBenef;
      const shouldPromote = shouldPromoteBeneficiaryToPatientIdentity({
        beneficiaryName,
        dteClientNames: dteByBeneficiaryRut.map((record) => record.clientName),
        patientName,
      });

      // Only promote BOLETA identity to patient when it actually
      // matches the patient.
      if (shouldPromote) {
        patientRut = beneficiaryRut;
        patientName =
          choosePreferredIdentityName(
            patientName,
            beneficiaryName ?? dteByBeneficiaryRut[0]?.clientName ?? null
          ) ??
          dteByBeneficiaryRut[0]?.clientName ??
          null;
      }
    }
  }

  if (!beneficiaryRut || !beneficiaryName) {
    const linkedDocuments = await db.$queryRaw<Array<{ clientName: string; clientRUT: string }>>`
      SELECT DISTINCT
        s.client_name AS "clientName",
        s.client_rut AS "clientRUT"
      FROM event_dte_sale_links l
      JOIN events e ON e.id = l.event_id
      JOIN dte_sale_details s ON s.id = l.dte_sale_detail_id
      WHERE e.clinical_series_id = ${seriesId}
        AND l.status != 'REJECTED'
    `;

    if (linkedDocuments.length === 1) {
      beneficiaryRut ||= linkedDocuments[0]?.clientRUT ?? null;
      beneficiaryName ||= linkedDocuments[0]?.clientName ?? null;
    }
  }

  const isSubcut = series.kind === "SUBCUTANEOUS_TREATMENT";
  const allergenType = isSubcut ? inferAllergenType(series.events) : null;
  const vaccineProduct = isSubcut ? inferVaccineProduct(series.events) : null;
  const { healthInsurance, isapreName } = inferHealthInsurance(series.events);
  const deliveryModality = isSubcut ? inferDeliveryModality(series.events) : null;
  const seriesPhones = series.events.reduce(
    (
      acc: { beneficiaryPhones: Set<string>; patientPhones: Set<string> },
      item: { description: null | string; summary: null | string }
    ) => {
      const extracted = extractSeriesPhones(item.summary ?? null, item.description ?? null);
      extracted.patientPhones.forEach((phone) => acc.patientPhones.add(phone));
      extracted.beneficiaryPhones.forEach((phone) => acc.beneficiaryPhones.add(phone));
      return acc;
    },
    { beneficiaryPhones: new Set<string>(), patientPhones: new Set<string>() }
  );

  await db.clinicalSeries.update({
    where: { id: seriesId },
    data: {
      allergenType,
      vaccineProduct,
      healthInsurance,
      isapreName,
      deliveryModality,
      beneficiaryName,
      beneficiaryPhones: [...seriesPhones.beneficiaryPhones],
      beneficiaryRut,
      displayName: buildSeriesDisplayName({
        kind: series.kind as ClinicalSeriesKind,
        patientName,
        patientRut,
      }),
      expectedSessions: computeExpectedSessions(series.events),
      patientName,
      patientPhones: [...seriesPhones.patientPhones],
      patientRut,
    },
  });
}
