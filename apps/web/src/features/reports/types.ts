import type { Movement } from "../../mp/reports";

export type LedgerMovement = Movement & { runningBalance: number; delta: number };
