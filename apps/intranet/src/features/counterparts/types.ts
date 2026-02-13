import type { Transaction } from "@/features/finance/types";

import type { CounterpartCategory } from "@/types/schema";

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
  createdAt: Date;
  id: number;
  identificationNumber: string;
  bankAccountHolder: string;
  notes: null | string;
  updatedAt: Date;
}

export interface CounterpartAccount {
  accountNumber: string;
  accountType: null | string;
  bankName: null | string;
  counterpartId: number;
  createdAt: Date;
  id: number;
  updatedAt: Date;
}

export interface CounterpartAccountSuggestion {
  accountIdentifier: string;
  accountType: null | string;
  assignedCounterpartId: null | number;
  bankAccountNumber: null | string;
  bankName: null | string;
  identificationNumber: null | string;
  totalAmount: number;
  withdrawId: null | string;
}

export interface UnassignedPayoutAccount {
  conflict: boolean;
  counterpartId: number | null;
  counterpartName: null | string;
  counterpartRut: null | string;
  movementCount: number;
  payoutBankAccountNumber: string;
  totalGrossAmount: number;
  withdrawRut: null | string;
}

export interface CounterpartDetail {
  accounts: CounterpartAccount[];
  counterpart: Counterpart;
}

export interface CounterpartSummary {
  releaseTotal: number;
  settlementCount: number;
  withdrawTotal: number;
}

export interface TransactionsApiResponse {
  data: Transaction[];
  message?: string;
  status: "error" | "ok";
}

export type { CounterpartCategory } from "@/types/schema";
