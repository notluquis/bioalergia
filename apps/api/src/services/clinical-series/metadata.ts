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
import { sanitizeRut } from "./normalization/rut.ts";
import type { ClinicalSeriesKind } from "./types.ts";

/**
 * Tier-1 authoritative name: a registered Person keyed by RUT. Person.rut is
 * mod-11 validated + unique and its name comes from registration/DTE, not
 * free-text parsing. Junk parser-made people have a NULL rut, so they are
 * never returned. Returns the composed full name, or null if no rut-keyed
 * Person exists.
 */
async function resolvePersonNameByRut(rut: null | string): Promise<null | string> {
  if (!rut) return null;
  const rows = await db.$queryRaw<
    Array<{ fatherName: null | string; motherName: null | string; names: string }>
  >`
    SELECT names, father_name AS "fatherName", mother_name AS "motherName"
    FROM people
    WHERE rut = ${rut}
    LIMIT 1
  `;
  const composed = [rows[0]?.names, rows[0]?.fatherName, rows[0]?.motherName]
    .filter(Boolean)
    .join(" ")
    .trim();
  return composed || null;
}

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

  // Preserve a previously-stored RUT when the current event text yields none.
  // RUTs can originate from non-text sources (DTE beneficiary promotion, manual
  // linking) that the text re-extraction cannot reproduce; a metadata refresh
  // must not DELETE that linkage just because the latest events don't restate
  // the RUT. (Without this, a broad refresh silently orphans those series.)
  patientRut ??= series.patientRut;
  beneficiaryRut ??= series.beneficiaryRut;

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

  // Recover the patient RUT from boletas linked to the series' OWN events: a
  // non-rejected DTE sale linked to these events is a strong, legitimate signal
  // of who the patient is (real billing), unlike free-text name guessing. When
  // there is still no patient RUT and the linked boletas agree on a single
  // client RUT, promote it to the patient identity.
  if (!patientRut) {
    const linkedSales = await db.$queryRaw<Array<{ clientName: string; clientRUT: string }>>`
      SELECT DISTINCT s.client_name AS "clientName", s.client_rut AS "clientRUT"
      FROM event_dte_sale_links l
      JOIN events e ON e.id = l.event_id
      JOIN dte_sale_details s ON s.id = l.dte_sale_detail_id
      WHERE e.clinical_series_id = ${seriesId}
        AND l.status != 'REJECTED'
        AND s.client_rut <> ''
    `;
    const distinctRuts = new Set(linkedSales.map((sale) => sale.clientRUT));
    if (distinctRuts.size === 1 && linkedSales[0]) {
      patientRut = sanitizeRut(linkedSales[0].clientRUT);
      patientName =
        upgradePatientNameFromDte(patientName, linkedSales) ??
        patientName ??
        linkedSales[0].clientName;
    }
  }

  // Apply the authoritative Person name last (resolved against the FINAL RUT,
  // including any recovered above) so it wins over the parsed hint and any
  // DTE/beneficiary/boleta promotion.
  const personCanonicalName = await resolvePersonNameByRut(patientRut);
  if (personCanonicalName) {
    patientName = personCanonicalName;
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
