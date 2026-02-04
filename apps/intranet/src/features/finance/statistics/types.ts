/**
 * Statistics Feature Types
 */

export interface MonthlyFlowData {
  in: number;
  month: string;
  net: number;
  out: number;
}

export interface MovementTypeData {
  description: null | string;
  direction: "IN" | "NEUTRO" | "OUT";
  total: number;
}

export interface StatsResponse {
  byType: MovementTypeData[];
  monthly: MonthlyFlowData[];
  status: "ok";
  totals: Record<string, number>;
}

export interface TopParticipantData {
  count: number;
  personId: string;
  personName: string;
  total: number;
}
