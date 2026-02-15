import type { CounterpartCategory } from "./types";

export const EMPTY_FORM = {
  category: "SUPPLIER" as CounterpartCategory,
  identificationNumber: "",
  bankAccountHolder: "",
  notes: "",
};

export const ACCOUNT_FORM_DEFAULT = {
  accountIdentifier: "",
  accountType: "",
  bankName: "",
};

export const CATEGORY_OPTIONS: { label: string; value: CounterpartCategory }[] = [
  { label: "Proveedor", value: "SUPPLIER" },
  { label: "Cliente", value: "CLIENT" },
  { label: "Empleado", value: "EMPLOYEE" },
  { label: "Socio", value: "PARTNER" },
  { label: "Prestamista", value: "LENDER" },
  { label: "Gasto personal (socios)", value: "PERSONAL_EXPENSE" },
  { label: "Otro", value: "OTHER" },
];

export const CATEGORY_LABELS = CATEGORY_OPTIONS.reduce<Record<string, string>>((acc, item) => {
  acc[item.value] = item.label;
  return acc;
}, {});

export const SUMMARY_RANGE_MONTHS = 6;
