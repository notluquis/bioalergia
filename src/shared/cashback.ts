import type { DbMovement } from "@/features/finance/transactions/types";

export function isCashbackCandidate(movement: DbMovement): boolean {
  if (!movement.description) return false;
  const desc = movement.description.toLowerCase();
  return desc.includes("cashback") || desc.includes("devolución");
}
