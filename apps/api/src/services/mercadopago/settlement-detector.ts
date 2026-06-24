const SETTLEMENT_HINTS = [
  "settlement",
  "liquidaci",
  "account_money",
  "all_transactions",
  "todas_las_transacciones",
  "todas-las-transacciones",
];

export function isSettlementReport(...inputs: Array<string | undefined | null>): boolean {
  const haystack = inputs
    .filter((v): v is string => Boolean(v))
    .join(" ")
    .toLowerCase();
  return SETTLEMENT_HINTS.some((hint) => haystack.includes(hint));
}
