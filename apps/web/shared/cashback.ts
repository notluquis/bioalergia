export const CASHBACK_KEYWORDS = ["cashback", "meli+", "melidolar", "meli dolar", "melidólar", "meli-dolar"];

export interface CashbackCandidate {
  description?: null | string;
  destination?: null | string;
  direction: string;
  origin?: null | string;
}

export function isCashbackCandidate(candidate: CashbackCandidate): boolean {
  if (candidate.direction.toUpperCase() !== "IN") {
    return false;
  }

  const haystack = [candidate.description, candidate.origin, candidate.destination]
    .filter((value): value is string => Boolean(value?.trim()))
    .join(" ")
    .toLowerCase();

  if (!haystack) return false;

  return CASHBACK_KEYWORDS.some((keyword) => haystack.includes(keyword));
}
