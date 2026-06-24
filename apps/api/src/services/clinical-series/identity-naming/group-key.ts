import { getSignificantNameTokens, normalizeName } from "../normalization/names.ts";
import { sanitizeRut } from "../normalization/rut.ts";

export function buildIdentityGroupKey(name: null | string, rut: null | string): null | string {
  const normalizedRut = sanitizeRut(rut);
  if (normalizedRut) return `rut:${normalizedRut}`;
  const normalizedName = name ? normalizeName(name) : "";
  return normalizedName ? `name:${normalizedName}` : null;
}

export function choosePreferredIdentityName(
  current: null | string,
  incoming: null | string
): null | string {
  if (!incoming) return current;
  if (!current) return incoming;
  const currentTokens = getSignificantNameTokens(current);
  const incomingTokens = getSignificantNameTokens(incoming);
  if (incomingTokens.length !== currentTokens.length) {
    return incomingTokens.length > currentTokens.length ? incoming : current;
  }
  return incoming.length > current.length ? incoming : current;
}
