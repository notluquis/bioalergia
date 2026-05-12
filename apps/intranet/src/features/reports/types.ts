import type { Movement } from "../../mp/reports";

export type LedgerMovement = Movement & { delta: number; runningBalance: number };
