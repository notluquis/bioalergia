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

export function normalizeAccountNumber(value: string): string {
  const compact = value.replace(/\s+/g, "").toUpperCase();
  if (!compact) {
    return "";
  }
  const normalized = compact.replace(/^0+/, "");
  return normalized.length > 0 ? normalized : "0";
}

export function accountFilterKey(filter: AccountTransactionFilter) {
  return `${filter.accountNumber ?? ""}`;
}

export function buildAccountTransactionFilter(
  account: CounterpartAccount,
): AccountTransactionFilter {
  const normalizedAccountNumber = normalizeAccountNumber(account.accountNumber.trim());
  return {
    accountNumber: normalizedAccountNumber || account.accountNumber.trim(),
  };
}
