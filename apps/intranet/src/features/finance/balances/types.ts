export interface BalanceDraft {
  note: string;
  value: string;
}

export interface BalancesApiResponse {
  days: DailyBalanceDay[];
  from: string;
  previous: null | { balance: number; date: string; note: null | string };
  status: "ok";
  to: string;
}

export interface DailyBalanceDay {
  date: string;
  difference: null | number;
  expectedBalance: null | number;
  hasCashback: boolean;
  netChange: number;
  note: null | string;
  recordedBalance: null | number;
  totalIn: number;
  totalOut: number;
}
