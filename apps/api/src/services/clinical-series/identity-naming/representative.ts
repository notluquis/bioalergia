import { hasIdentitySourceText, resolveClinicalIdentity } from "../extraction/identity.ts";
import { compareRepresentativeIdentity, haveCompatiblePatientNames } from "../matching/compare.ts";
import { isLikelyPersonName } from "../normalization/names.ts";
import { sanitizeRut } from "../normalization/rut.ts";
import type { ClinicalIdentity, IdentityNameCounts, StoredClinicalIdentity } from "../types.ts";

import { chooseDominantIdentityName, incrementIdentityNameCount } from "./dominant.ts";
import { buildIdentityGroupKey, choosePreferredIdentityName } from "./group-key.ts";

export function shouldPromoteBeneficiaryToPatientIdentity(params: {
  beneficiaryName: null | string;
  dteClientNames?: string[];
  patientName: null | string;
}): boolean {
  const { beneficiaryName, dteClientNames = [], patientName } = params;
  if (!patientName) return true;
  if (beneficiaryName && haveCompatiblePatientNames(patientName, beneficiaryName)) return true;
  return dteClientNames.some((clientName) => haveCompatiblePatientNames(patientName, clientName));
}

export function selectRepresentativeClinicalIdentity(
  events: Array<{
    description: null | string;
    summary: null | string;
  }>,
  stored?: StoredClinicalIdentity
): ClinicalIdentity {
  const patientGroups = new Map<
    string,
    ClinicalIdentity & { eventCount: number; patientNameCounts: IdentityNameCounts }
  >();
  const beneficiaryGroups = new Map<
    string,
    ClinicalIdentity & { beneficiaryNameCounts: IdentityNameCounts; eventCount: number }
  >();
  let hasText = false;

  for (const event of events) {
    const eventHasText = hasIdentitySourceText(event.summary, event.description);
    hasText ||= eventHasText;
    const hints = resolveClinicalIdentity(event.summary, event.description);

    const patientKey = buildIdentityGroupKey(hints.patientName, hints.patientRut);
    if (patientKey) {
      const current = patientGroups.get(patientKey);
      const patientNameCounts = current?.patientNameCounts ?? new Map();
      incrementIdentityNameCount(patientNameCounts, hints.patientName);
      patientGroups.set(patientKey, {
        beneficiaryName: null,
        beneficiaryRut: null,
        eventCount: (current?.eventCount ?? 0) + 1,
        patientName: chooseDominantIdentityName(
          choosePreferredIdentityName(current?.patientName ?? null, hints.patientName),
          patientNameCounts
        ),
        patientNameCounts,
        patientRut: hints.patientRut ?? current?.patientRut ?? null,
      });
    }

    const beneficiaryKey = buildIdentityGroupKey(hints.beneficiaryName, hints.beneficiaryRut);
    const sameAsPatient =
      beneficiaryKey != null && patientKey != null && beneficiaryKey === patientKey;
    if (beneficiaryKey && !sameAsPatient) {
      const current = beneficiaryGroups.get(beneficiaryKey);
      const beneficiaryNameCounts = current?.beneficiaryNameCounts ?? new Map();
      incrementIdentityNameCount(beneficiaryNameCounts, hints.beneficiaryName);
      beneficiaryGroups.set(beneficiaryKey, {
        beneficiaryName: chooseDominantIdentityName(
          choosePreferredIdentityName(current?.beneficiaryName ?? null, hints.beneficiaryName),
          beneficiaryNameCounts
        ),
        beneficiaryNameCounts,
        beneficiaryRut: hints.beneficiaryRut ?? current?.beneficiaryRut ?? null,
        eventCount: (current?.eventCount ?? 0) + 1,
        patientName: null,
        patientRut: null,
      });
    }
  }

  if (!hasText) {
    return {
      beneficiaryName:
        stored?.beneficiaryName && isLikelyPersonName(stored.beneficiaryName)
          ? stored.beneficiaryName
          : null,
      beneficiaryRut: sanitizeRut(stored?.beneficiaryRut ?? null),
      patientName: stored?.patientName ?? null,
      patientRut: sanitizeRut(stored?.patientRut ?? null),
    };
  }

  const patient = [...patientGroups.values()].sort(compareRepresentativeIdentity)[0] ?? null;
  const patientKey = buildIdentityGroupKey(
    patient?.patientName ?? null,
    patient?.patientRut ?? null
  );
  const beneficiary =
    [...beneficiaryGroups.values()]
      .filter((candidate) => {
        const candidateKey = buildIdentityGroupKey(
          candidate.beneficiaryName ?? null,
          candidate.beneficiaryRut ?? null
        );
        return candidateKey != null && candidateKey !== patientKey;
      })
      .sort(compareRepresentativeIdentity)[0] ?? null;

  return {
    beneficiaryName: beneficiary?.beneficiaryName ?? null,
    beneficiaryRut: beneficiary?.beneficiaryRut ?? null,
    patientName: patient?.patientName ?? null,
    patientRut: patient?.patientRut ?? null,
  };
}
