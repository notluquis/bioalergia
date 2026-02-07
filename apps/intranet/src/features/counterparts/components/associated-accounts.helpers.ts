import type { CounterpartAccount } from "../types";

export interface AccountForm {
  accountNumber: string;
  accountType: string;
  bankName: string;
}

export const ACCOUNT_FORM_DEFAULT: AccountForm = {
  accountNumber: "",
  accountType: "",
  bankName: "",
};

export interface AccountGroup {
  accounts: CounterpartAccount[];
  bankName: null | string;
  key: string;
  label: string;
}

export interface AccountTransactionFilter {
  accountNumber?: string;
}

export interface DateRange {
  from: string;
  to: string;
}

export function accountFilterKey(filter: AccountTransactionFilter) {
  return `${filter.accountNumber ?? ""}`;
}

export function buildAccountTransactionFilter(
  account: CounterpartAccount,
): AccountTransactionFilter {
  return {
    accountNumber: account.accountNumber.trim(),
  };
}
