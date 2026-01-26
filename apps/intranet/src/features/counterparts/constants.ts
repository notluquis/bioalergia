import type { CounterpartCategory, CounterpartPersonType } from "./types";

export const EMPTY_FORM = {
  category: "SUPPLIER" as CounterpartCategory,
  email: "",
  name: "",
  notes: "",
  personType: "COMPANY" as CounterpartPersonType,
  rut: "",
};

export const ACCOUNT_FORM_DEFAULT = {
  accountIdentifier: "",
  accountType: "",
  bankAccountNumber: "",
  bankName: "",
  concept: "",
  holder: "",
};

export const CATEGORY_OPTIONS: { label: string; value: CounterpartCategory }[] = [
  { label: "Proveedor", value: "SUPPLIER" },
  { label: "Paciente", value: "PATIENT" },
  { label: "Empleado", value: "EMPLOYEE" },
  { label: "Socio", value: "PARTNER" },
  { label: "Relacionado a socio", value: "RELATED" },
  { label: "Cliente", value: "CLIENT" },
  { label: "Prestamista", value: "LENDER" },
  { label: "Ocasional", value: "OCCASIONAL" },
  { label: "Otro", value: "OTHER" },
];

export const CATEGORY_LABELS = CATEGORY_OPTIONS.reduce<Record<string, string>>((acc, item) => {
  acc[item.value] = item.label;
  return acc;
}, {});

export const SUMMARY_RANGE_MONTHS = 6;
