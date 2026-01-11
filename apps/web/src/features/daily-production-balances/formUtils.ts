import dayjs from "dayjs";

import { coerceAmount } from "@/lib/format";

import type { ProductionBalancePayload, ProductionBalanceStatus } from "./types";

/**
 * Form state interface for production balance form
 */
export interface FormState {
  date: string;
  status: ProductionBalanceStatus;
  ingresoTarjetas: string;
  ingresoTransferencias: string;
  ingresoEfectivo: string;
  gastosDiarios: string;
  otrosAbonos: string;
  consultas: string;
  controles: string;
  tests: string;
  vacunas: string;
  licencias: string;
  roxair: string;
  comentarios: string;
  reason: string;
}

/**
 * Creates a default form state with optional date
 */
export function makeDefaultForm(dateStr?: string): FormState {
  return {
    date: dateStr ?? dayjs().format("YYYY-MM-DD"),
    status: "DRAFT",
    ingresoTarjetas: "",
    ingresoTransferencias: "",
    ingresoEfectivo: "",
    gastosDiarios: "",
    otrosAbonos: "",
    consultas: "",
    controles: "",
    tests: "",
    vacunas: "",
    licencias: "",
    roxair: "",
    comentarios: "",
    reason: "",
  };
}

/**
 * Converts form state to API payload
 */
export function toPayload(form: FormState): ProductionBalancePayload {
  return {
    date: form.date,
    ingresoTarjetas: coerceAmount(form.ingresoTarjetas),
    ingresoTransferencias: coerceAmount(form.ingresoTransferencias),
    ingresoEfectivo: coerceAmount(form.ingresoEfectivo),
    gastosDiarios: coerceAmount(form.gastosDiarios),
    otrosAbonos: coerceAmount(form.otrosAbonos),
    consultas: coerceAmount(form.consultas),
    controles: coerceAmount(form.controles),
    tests: coerceAmount(form.tests),
    vacunas: coerceAmount(form.vacunas),
    licencias: coerceAmount(form.licencias),
    roxair: coerceAmount(form.roxair),
    comentarios: form.comentarios.trim() || null,
    status: form.status,
    reason: form.reason.trim() || null,
  };
}
