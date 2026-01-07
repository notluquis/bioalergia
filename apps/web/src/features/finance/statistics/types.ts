/**
 * Statistics Feature Types
 */

export interface MonthlyFlowData {
  month: string;
  in: number;
  out: number;
  net: number;
}

export interface MovementTypeData {
  description: string | null;
  direction: "IN" | "OUT" | "NEUTRO";
  total: number;
}

export interface StatsResponse {
  status: "ok";
  monthly: MonthlyFlowData[];
  totals: Record<string, number>;
  byType: MovementTypeData[];
}

export interface TopParticipantData {
  personId: number;
  personName: string;
  total: number;
  count: number;
}
