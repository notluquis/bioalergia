import jaroWinkler from "talisman/metrics/jaro-winkler.js";

import { getSignificantNameTokens } from "../normalization/names.ts";

import { isAllLowercase } from "./dominant.ts";

/**
 * If the DTE clientName (from SII, typically full legal name) is a
 * more complete version of the current patientName, return the DTE
 * name as the upgrade.
 *
 * Matches when:
 * - All significant tokens of the current name fuzzy-match a token
 *   in the DTE name (Jaro-Winkler >= 0.90 to tolerate minor spelling
 *   differences like "krausse"/"krause")
 * - The DTE name has at least 2 significant tokens
 * - The DTE name has strictly more tokens than the current name
 */
export function upgradePatientNameFromDte(
  currentName: null | string,
  dteRecords: Array<{ clientName: string }>
): null | string {
  if (!currentName) return dteRecords[0]?.clientName ?? null;

  const currentTokens = getSignificantNameTokens(currentName);
  if (currentTokens.length === 0) return null;

  let best: null | string = null;
  let bestTokenCount = currentTokens.length;
  let bestIsCaseUpgrade = false;

  for (const dte of dteRecords) {
    if (!dte.clientName) continue;
    const dteTokens = getSignificantNameTokens(dte.clientName);

    // Must be a plausible person name: at least 2 significant tokens
    if (dteTokens.length < 2) continue;

    // Every current token must fuzzy-match at least one DTE token (JW >= 0.90)
    const allMatch = currentTokens.every((ct) =>
      dteTokens.some((dt) => jaroWinkler(ct, dt) >= 0.9)
    );
    if (!allMatch) continue;

    // Prefer the DTE name with the most tokens (most complete)
    if (dteTokens.length > bestTokenCount) {
      best = dte.clientName;
      bestTokenCount = dteTokens.length;
      bestIsCaseUpgrade = false;
    } else if (
      dteTokens.length >= currentTokens.length &&
      !bestIsCaseUpgrade &&
      best === null &&
      isAllLowercase(currentName) &&
      !isAllLowercase(dte.clientName)
    ) {
      // Current name is all lowercase but DTE has proper casing — adopt it
      best = dte.clientName;
      bestIsCaseUpgrade = true;
    }
  }

  return best;
}
