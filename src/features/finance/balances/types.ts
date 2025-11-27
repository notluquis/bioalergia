export type DailyBalanceDay = {
  date: string;
  totalIn: number;
  totalOut: number;
  netChange: number;
  expectedBalance: number | null;
  recordedBalance: number | null;
  difference: number | null;
  note: string | null;
  hasCashback: boolean;
};

export type BalancesApiResponse = {
  status: "ok";
  from: string;
  to: string;
  previous: { date: string; balance: number; note: string | null } | null;
  days: DailyBalanceDay[];
};

export type BalanceDraft = {
  value: string;
  note: string;
};
