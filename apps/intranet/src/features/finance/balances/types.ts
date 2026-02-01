export interface BalanceDraft {
  note: string;
  value: string;
}

export interface BalancesApiResponse {
  days: DailyBalanceDay[];
  from: Date;
  previous: null | { balance: number; date: Date; note: null | string };
  status: "ok";
  to: Date;
}

export interface DailyBalanceDay {
  date: Date;
  difference: null | number;
  expectedBalance: null | number;
  hasCashback: boolean;
  netChange: number;
  note: null | string;
  recordedBalance: null | number;
  totalIn: number;
  totalOut: number;
}
