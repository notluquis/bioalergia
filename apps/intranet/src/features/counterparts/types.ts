import type { Transaction } from "@/features/finance/types";

import type { CounterpartCategory, PersonType } from "@/types/schema";

export interface AccountGroup {
  accounts: CounterpartAccount[];
  bankName: null | string;
  concept: string;
  holder: null | string;
  key: string;
  label: string;
}

export interface AccountTransactionsState {
  error: null | string;
  expanded: boolean;
  loading: boolean;
  recentTransactions?: Transaction[];
}

export interface Counterpart {
  category: CounterpartCategory;
  created_at: Date;
  email: null | string;
  employeeId: null | number;
  id: number;
  name: string;
  notes: null | string;
  personType: CounterpartPersonType;
  rut: null | string;
  updated_at: Date;
}

export interface CounterpartAccount {
  account_identifier: string;
  account_type: null | string;
  bank_name: null | string;
  concept: null | string;
  counterpart_id: number;
  created_at: Date;
  holder: null | string;
  id: number;
  metadata: CounterpartAccountMetadata | null;
  summary?: null | {
    movements: number;
    totalAmount: number;
  };
  updated_at: Date;
}

export interface CounterpartAccountMetadata {
  bankAccountNumber?: null | string;
  withdrawId?: null | string;
}

export interface CounterpartAccountSuggestion {
  accountIdentifier: string;
  accountType: null | string;
  assignedCounterpartId: null | number;
  bankAccountNumber: null | string;
  bankName: null | string;
  holder: null | string;
  movements: number;
  rut: null | string;
  totalAmount: number;
  withdrawId: null | string;
}

export interface CounterpartDetail {
  accounts: CounterpartAccount[];
  counterpart: Counterpart;
}

export type CounterpartPersonType = PersonType;

export interface CounterpartSummary {
  byAccount: {
    account_identifier: string;
    bank_name: null | string;
    concept: null | string;
    count: number;
    total: number;
  }[];
  monthly: { concept: string; month: string; total: number }[];
}

export interface TransactionsApiResponse {
  data: Transaction[];
  message?: string;
  status: "error" | "ok";
}

export type { CounterpartCategory } from "@/types/schema";
