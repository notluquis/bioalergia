import type { CounterpartAccount } from "../types";

export type AccountForm = {
  accountIdentifier: string;
  bankName: string;
  accountType: string;
  holder: string;
  concept: string;
  bankAccountNumber: string;
};

export const ACCOUNT_FORM_DEFAULT: AccountForm = {
  accountIdentifier: "",
  bankName: "",
  accountType: "",
  holder: "",
  concept: "",
  bankAccountNumber: "",
};

export type DateRange = { from: string; to: string };

export type AccountGroup = {
  key: string;
  label: string;
  bankName: string | null;
  holder: string | null;
  concept: string;
  accounts: CounterpartAccount[];
};

export type AccountTransactionFilter = {
  sourceId?: string;
  bankAccountNumber?: string;
};

export function buildAccountTransactionFilter(account: CounterpartAccount): AccountTransactionFilter {
  const withdrawId = account.metadata?.withdrawId?.trim();
  const bankAccountNumber = account.metadata?.bankAccountNumber?.trim() || account.account_identifier.trim();
  const filter: AccountTransactionFilter = {};
  if (withdrawId) {
    filter.sourceId = withdrawId;
  }
  if (bankAccountNumber) {
    filter.bankAccountNumber = bankAccountNumber;
  }
  return filter;
}

export function accountFilterKey(filter: AccountTransactionFilter) {
  return `${filter.sourceId ?? ""}|${filter.bankAccountNumber ?? ""}`;
}
