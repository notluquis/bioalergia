import type { DbMovement } from "../transactions/types";

export type CounterpartPersonType = "PERSON" | "COMPANY" | "OTHER";
export type CounterpartCategory = "SUPPLIER" | "PATIENT" | "EMPLOYEE" | "PARTNER" | "RELATED" | "OTHER";

export type Counterpart = {
  id: number;
  rut: string | null;
  name: string;
  personType: CounterpartPersonType;
  category: CounterpartCategory;
  employeeId: number | null;
  email: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type CounterpartAccountMetadata = {
  bankAccountNumber?: string | null;
  withdrawId?: string | null;
};

export type CounterpartAccount = {
  id: number;
  counterpart_id: number;
  account_identifier: string;
  bank_name: string | null;
  account_type: string | null;
  holder: string | null;
  concept: string | null;
  metadata: CounterpartAccountMetadata | null;
  created_at: string;
  updated_at: string;
  summary?: {
    totalAmount: number;
    movements: number;
  } | null;
};

export type CounterpartDetail = {
  counterpart: Counterpart;
  accounts: CounterpartAccount[];
};

export type CounterpartAccountSuggestion = {
  accountIdentifier: string;
  rut: string | null;
  holder: string | null;
  bankName: string | null;
  accountType: string | null;
  bankAccountNumber: string | null;
  withdrawId: string | null;
  totalAmount: number;
  movements: number;
  assignedCounterpartId: number | null;
};

export type CounterpartSummary = {
  monthly: Array<{ month: string; concept: string; total: number }>;
  byAccount: Array<{
    account_identifier: string;
    concept: string | null;
    bank_name: string | null;
    total: number;
    count: number;
  }>;
};

export type AccountTransactionsState = {
  expanded: boolean;
  loading: boolean;
  error: string | null;
  rows: DbMovement[];
};

export type TransactionsApiResponse = {
  status: "ok" | "error";
  data: DbMovement[];
  message?: string;
};

export type AccountGroup = {
  key: string;
  label: string;
  bankName: string | null;
  holder: string | null;
  concept: string;
  accounts: CounterpartAccount[];
};
