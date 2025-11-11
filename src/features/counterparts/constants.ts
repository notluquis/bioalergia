import type { CounterpartCategory, CounterpartPersonType } from "./types";

export const EMPTY_FORM = {
  rut: "",
  name: "",
  personType: "COMPANY" as CounterpartPersonType,
  category: "SUPPLIER" as CounterpartCategory,
  email: "",
  notes: "",
};

export const ACCOUNT_FORM_DEFAULT = {
  accountIdentifier: "",
  bankName: "",
  accountType: "",
  holder: "",
  concept: "",
  bankAccountNumber: "",
};

export const CATEGORY_OPTIONS: Array<{ value: CounterpartCategory; label: string }> = [
  { value: "SUPPLIER", label: "Proveedor" },
  { value: "PATIENT", label: "Paciente" },
  { value: "EMPLOYEE", label: "Empleado" },
  { value: "PARTNER", label: "Socio" },
  { value: "RELATED", label: "Relacionado a socio" },
  { value: "CLIENT", label: "Cliente" },
  { value: "LENDER", label: "Prestamista" },
  { value: "OCCASIONAL", label: "Ocasional" },
  { value: "OTHER", label: "Otro" },
];

export const CATEGORY_LABELS = CATEGORY_OPTIONS.reduce<Record<string, string>>((acc, item) => {
  acc[item.value] = item.label;
  return acc;
}, {});

export const SUMMARY_RANGE_MONTHS = 6;
