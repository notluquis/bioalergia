export type DbPayout = {
  withdrawId: string;
  dateCreated: string | null;
  status: string | null;
  statusDetail: string | null;
  amount: number | null;
  fee: number | null;
  payoutDesc: string | null;
  bankAccountHolder: string | null;
  bankName: string | null;
  bankAccountType: string | null;
  bankAccountNumber: string | null;
  bankBranch: string | null;
  identificationType: string | null;
  identificationNumber: string | null;
};

export type DbMovement = {
  id: number;
  timestamp: string;
  timestamp_raw?: string | null;
  description: string | null;
  origin: string | null;
  destination: string | null;
  source_id: string | null;
  direction: "IN" | "OUT" | "NEUTRO";
  amount: number | null;
  payout: DbPayout | null;
  loanSchedule?: {
    id: number;
    installmentNumber: number;
    status: "PENDING" | "PARTIAL" | "PAID" | "OVERDUE";
    dueDate: string | null;
    expectedAmount: number | null;
    loanTitle: string | null;
    loanPublicId: string | null;
  } | null;
  serviceSchedule?: {
    id: number;
    status: "PENDING" | "PAID" | "PARTIAL" | "SKIPPED";
    dueDate: string | null;
    expectedAmount: number | null;
    serviceName: string | null;
    servicePublicId: string | null;
    periodStart: string | null;
  } | null;
};

export type LedgerRow = DbMovement & { runningBalance: number; delta: number };

export type Filters = {
  from: string;
  to: string;
  description: string;
  origin: string;
  destination: string;
  sourceId: string;
  bankAccountNumber: string;
  direction: "" | "IN" | "OUT" | "NEUTRO";
  includeAmounts: boolean;
};

export type ApiResponse = {
  status: "ok" | "error";
  data: DbMovement[];
  hasAmounts?: boolean;
  total?: number;
  page?: number;
  pageSize?: number;
  message?: string;
};
