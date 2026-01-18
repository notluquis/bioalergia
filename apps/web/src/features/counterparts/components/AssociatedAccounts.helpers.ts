import type { CounterpartAccount } from "../types";

export interface AccountForm {
  accountIdentifier: string;
  accountType: string;
  bankAccountNumber: string;
  bankName: string;
  concept: string;
  holder: string;
}

export const ACCOUNT_FORM_DEFAULT: AccountForm = {
  accountIdentifier: "",
  accountType: "",
  bankAccountNumber: "",
  bankName: "",
  concept: "",
  holder: "",
};

export interface AccountGroup {
  accounts: CounterpartAccount[];
  bankName: null | string;
  concept: string;
  holder: null | string;
  key: string;
  label: string;
}

export interface AccountTransactionFilter {
  bankAccountNumber?: string;
  sourceId?: string;
}

export interface DateRange {
  from: string;
  to: string;
}

export function accountFilterKey(filter: AccountTransactionFilter) {
  return `${filter.sourceId ?? ""}|${filter.bankAccountNumber ?? ""}`;
}

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
