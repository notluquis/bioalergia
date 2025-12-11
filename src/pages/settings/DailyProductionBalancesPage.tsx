import { useMemo, useState, useEffect } from "react";
import type { ChangeEvent, FormEvent } from "react";
import dayjs from "dayjs";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import Alert from "@/components/ui/Alert";
import { useToast } from "@/context/ToastContext";
import { useSettings } from "@/context/SettingsContext";
import {
  CreditCard,
  Banknote,
  Wallet,
  TrendingDown,
  FileText,
  Syringe,
  ClipboardList,
  Calendar,
  Save,
  History,
} from "lucide-react";
import {
  fetchProductionBalanceHistory,
  fetchProductionBalances,
  saveProductionBalance,
} from "@/features/dailyProductionBalances/api";
import type { ProductionBalancePayload, ProductionBalanceStatus } from "@/features/dailyProductionBalances/types";
import { deriveTotals } from "@/features/dailyProductionBalances/utils";
import WeekView from "@/features/dailyProductionBalances/components/WeekView";
import { useAuth } from "@/context/AuthContext";

type FormState = {
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
};

const makeDefaultForm = (date?: string): FormState => ({
  date: date || dayjs().format("YYYY-MM-DD"),
  status: "FINAL",
  ingresoTarjetas: "0",
  ingresoTransferencias: "0",
  ingresoEfectivo: "0",
  gastosDiarios: "0",
  otrosAbonos: "0",
  consultas: "0",
  controles: "0",
  tests: "0",
  vacunas: "0",
  licencias: "0",
  roxair: "0",
  comentarios: "",
  reason: "",
});

function parseNumber(value: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.round(parsed);
}

function formatInputValue(value: string): string {
  // Remove non-numeric characters except for negative sign
  const numericValue = value.replace(/[^0-9-]/g, "");
  if (!numericValue || numericValue === "-") return "";
  const parsed = parseInt(numericValue, 10);
  if (isNaN(parsed)) return "";
  // Format with thousands separator
  return new Intl.NumberFormat("es-CL").format(parsed);
}

function parseInputValue(value: string): string {
  // Remove formatting and return just the number
  return value.replace(/[^0-9-]/g, "");
}

function toPayload(form: FormState): ProductionBalancePayload {
  return {
    date: form.date,
    ingresoTarjetas: parseNumber(form.ingresoTarjetas),
    ingresoTransferencias: parseNumber(form.ingresoTransferencias),
    ingresoEfectivo: parseNumber(form.ingresoEfectivo),
    gastosDiarios: parseNumber(form.gastosDiarios),
    otrosAbonos: parseNumber(form.otrosAbonos),
    consultas: parseNumber(form.consultas),
    controles: parseNumber(form.controles),
    tests: parseNumber(form.tests),
    vacunas: parseNumber(form.vacunas),
    licencias: parseNumber(form.licencias),
    roxair: parseNumber(form.roxair),
    comentarios: form.comentarios.trim() ? form.comentarios.trim() : null,
    status: form.status,
    reason: form.reason.trim() ? form.reason.trim() : null,
  };
}

export default function DailyProductionBalancesPage() {
  const { hasRole } = useAuth();
  const canEdit = hasRole("GOD", "ADMIN", "ANALYST");

  const queryClient = useQueryClient();
  const { success: toastSuccess, error: toastError } = useToast();
  const { settings } = useSettings();
  const currencyFormatter = useMemo(
    () =>
      new Intl.NumberFormat("es-CL", {
        style: "currency",
        currency: settings.primaryCurrency || "CLP",
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }),
    [settings.primaryCurrency]
  );

  // State for WeekView
  const [currentDate, setCurrentDate] = useState(dayjs());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  // Calculate range for the current week view
  const startOfWeek = currentDate.startOf("week").add(1, "day");
  const endOfWeek = startOfWeek.add(6, "day");
  const from = startOfWeek.format("YYYY-MM-DD");
  const to = endOfWeek.format("YYYY-MM-DD");

  const [form, setForm] = useState<FormState>(() => makeDefaultForm());
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const balancesQuery = useQuery({
    queryKey: ["production-balances", from, to],
    queryFn: () => fetchProductionBalances(from, to),
  });

  const historyQuery = useQuery({
    queryKey: ["production-balance-history", selectedId],
    enabled: selectedId != null,
    queryFn: () => fetchProductionBalanceHistory(selectedId ?? 0),
  });

  const mutation = useMutation({
    mutationFn: async () => {
      const payload = toPayload(form);
      return saveProductionBalance(payload, selectedId);
    },
    onSuccess: (saved) => {
      toastSuccess("Balance guardado correctamente");
      setSelectedId(saved.id);
      setForm((prev) => ({ ...prev, reason: "" }));
      queryClient.invalidateQueries({ queryKey: ["production-balances"] });
      queryClient.invalidateQueries({ queryKey: ["production-balance-history", saved.id] });
    },
    onError: (err: unknown) => {
      const message = err instanceof Error ? err.message : "No se pudo guardar el balance";
      toastError(message);
    },
  });

  const balances = useMemo(() => balancesQuery.data ?? [], [balancesQuery.data]);

  // When a date is selected, find the balance for that date or reset form
  useEffect(() => {
    if (!selectedDate) {
      setSelectedId(null);
      return;
    }

    const balance = balances.find((b) => b.date === selectedDate);
    if (balance) {
      setSelectedId(balance.id);
      setForm({
        date: balance.date,
        status: balance.status,
        ingresoTarjetas: String(balance.ingresoTarjetas),
        ingresoTransferencias: String(balance.ingresoTransferencias),
        ingresoEfectivo: String(balance.ingresoEfectivo),
        gastosDiarios: String(balance.gastosDiarios),
        otrosAbonos: String(balance.otrosAbonos),
        consultas: String(balance.consultas),
        controles: String(balance.controles),
        tests: String(balance.tests),
        vacunas: String(balance.vacunas),
        licencias: String(balance.licencias),
        roxair: String(balance.roxair),
        comentarios: balance.comentarios ?? "",
        reason: "",
      });
    } else {
      setSelectedId(null);
      setForm(makeDefaultForm(selectedDate));
    }
  }, [selectedDate, balances]);

  const derived = deriveTotals({
    ingresoTarjetas: parseNumber(form.ingresoTarjetas),
    ingresoTransferencias: parseNumber(form.ingresoTransferencias),
    ingresoEfectivo: parseNumber(form.ingresoEfectivo),
    gastosDiarios: parseNumber(form.gastosDiarios),
    otrosAbonos: parseNumber(form.otrosAbonos),
  });

  // Calculate service totals for dual-accounting validation
  const serviceTotals =
    parseNumber(form.consultas) +
    parseNumber(form.controles) +
    parseNumber(form.tests) +
    parseNumber(form.vacunas) +
    parseNumber(form.licencias) +
    parseNumber(form.roxair);

  const paymentMethodTotal = derived.total;
  const hasDifference = serviceTotals !== paymentMethodTotal;
  const difference = serviceTotals - paymentMethodTotal;

  const handleChange =
    (key: keyof FormState) => (event: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
      setForm((prev) => ({ ...prev, [key]: event.target.value }));
    };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    mutation.mutate();
  };

  return (
    <section className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <div className="bg-primary/10 text-primary flex h-12 w-12 items-center justify-center rounded-2xl">
            <Calendar className="h-6 w-6" />
          </div>
          <div>
            <p className="text-primary text-xs font-semibold tracking-wide uppercase">Finanzas</p>
            <h1 className="text-base-content text-3xl font-bold">Balance Diario</h1>
          </div>
        </div>
        <p className="text-base-content/70 max-w-3xl text-base">
          Registra ingresos, gastos y actividades diarias de forma rápida y eficiente.
        </p>
      </div>

      <WeekView
        currentDate={currentDate}
        onDateChange={setCurrentDate}
        balances={balances}
        onSelectDay={setSelectedDate}
        selectedDate={selectedDate}
      />

      {selectedDate && (
        <div
          className={`grid gap-6 ${canEdit ? "lg:grid-cols-[1fr_400px]" : "lg:grid-cols-1"} animate-in fade-in slide-in-from-bottom-2 duration-300`}
        >
          {canEdit && (
            <div className="space-y-4">
              <div
                className="card bg-base-100 border-2 shadow-lg"
                style={{ borderColor: form.status === "FINAL" ? "oklch(var(--su))" : "oklch(var(--wa))" }}
              >
                <div className="card-body">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <Calendar className="text-primary h-6 w-6" />
                        <div>
                          <h2 className="text-base-content text-2xl font-bold capitalize">
                            {dayjs(selectedDate).format("dddd D [de] MMMM")}
                          </h2>
                          <div className="mt-1 flex items-center gap-2">
                            <span
                              className={`badge badge-sm ${
                                form.status === "FINAL" ? "badge-success" : "badge-warning"
                              }`}
                            >
                              {form.status === "FINAL" ? "✓ CERRADO" : "⏱ BORRADOR"}
                            </span>
                            <span className="text-base-content/60 text-xs">
                              {selectedId ? `#${selectedId} · Editando` : "Nuevo registro"}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="dropdown dropdown-end">
                        <label
                          tabIndex={0}
                          className={`btn btn-sm gap-2 ${form.status === "FINAL" ? "btn-success" : "btn-warning"}`}
                        >
                          {form.status === "FINAL" ? "✓ CERRADO" : "⏱ BORRADOR"}
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            fill="none"
                            viewBox="0 0 24 24"
                            className="h-4 w-4 stroke-current"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth="2"
                              d="M19 9l-7 7-7-7"
                            ></path>
                          </svg>
                        </label>
                        <ul
                          tabIndex={0}
                          className="dropdown-content menu bg-base-100 rounded-box border-base-300 z-1 mt-2 w-80 border p-2 shadow-lg"
                        >
                          <li className="menu-title">
                            <span className="text-xs font-bold">Estado del Balance</span>
                          </li>
                          <li>
                            <a
                              className={form.status === "DRAFT" ? "active" : ""}
                              onClick={() => setForm((prev) => ({ ...prev, status: "DRAFT" }))}
                            >
                              <div className="flex items-start gap-2 py-2">
                                <span className="badge badge-warning badge-sm mt-1">⏱</span>
                                <div className="flex-1">
                                  <div className="font-semibold">Borrador</div>
                                  <div className="text-xs opacity-70">
                                    Aún estoy ingresando datos o revisando. Puede tener errores.
                                  </div>
                                </div>
                              </div>
                            </a>
                          </li>
                          <li>
                            <a
                              className={form.status === "FINAL" ? "active" : ""}
                              onClick={() => {
                                if (hasDifference) {
                                  if (
                                    !confirm("⚠️ Los totales no coinciden. ¿Estás seguro de marcarlo como CERRADO?")
                                  ) {
                                    return;
                                  }
                                }
                                setForm((prev) => ({ ...prev, status: "FINAL" }));
                              }}
                            >
                              <div className="flex items-start gap-2 py-2">
                                <span className="badge badge-success badge-sm mt-1">✓</span>
                                <div className="flex-1">
                                  <div className="font-semibold">Cerrado (Final)</div>
                                  <div className="text-xs opacity-70">
                                    Datos completos y verificados. Registro oficial.
                                  </div>
                                </div>
                              </div>
                            </a>
                          </li>
                        </ul>
                      </div>
                      <Button type="button" variant="ghost" size="sm" onClick={() => setSelectedDate(null)}>
                        Cerrar
                      </Button>
                    </div>
                  </div>
                </div>
              </div>

              <form className="space-y-4" onSubmit={handleSubmit}>
                <div className="alert alert-info text-sm">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    className="h-5 w-5 shrink-0 stroke-current"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    ></path>
                  </svg>
                  <span>
                    <strong>Flujo de trabajo:</strong> 1) Registra ingresos por método de pago → 2) Registra ingresos
                    por tipo de servicio → 3) Verifica que ambos totales coincidan
                  </span>
                </div>

                {/* PASO 1: Ingresos por Método de Pago */}
                <div className="card bg-success/5 border-success/20 border-2">
                  <div className="card-body gap-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="badge badge-lg badge-success font-bold">1</div>
                        <div>
                          <h3 className="text-base-content text-lg font-bold">Ingresos por Método de Pago</h3>
                          <p className="text-base-content/60 text-xs">¿Cómo ingresó el dinero?</p>
                        </div>
                      </div>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-3">
                      <div className="form-control">
                        <label className="label py-1">
                          <span className="label-text flex items-center gap-1.5 text-sm font-medium">
                            <CreditCard className="h-4 w-4" />
                            Tarjetas
                          </span>
                        </label>
                        <label className="input input-bordered input-sm flex items-center gap-2">
                          <span className="text-base-content/60">$</span>
                          <input
                            type="text"
                            inputMode="numeric"
                            value={formatInputValue(form.ingresoTarjetas)}
                            onChange={(e) => {
                              const parsed = parseInputValue(e.target.value);
                              setForm((prev) => ({ ...prev, ingresoTarjetas: parsed }));
                            }}
                            className="grow bg-transparent"
                            placeholder="0"
                          />
                        </label>
                      </div>
                      <div className="form-control">
                        <label className="label py-1">
                          <span className="label-text flex items-center gap-1.5 text-sm font-medium">
                            <Banknote className="h-4 w-4" />
                            Transferencias
                          </span>
                        </label>
                        <label className="input input-bordered input-sm flex items-center gap-2">
                          <span className="text-base-content/60">$</span>
                          <input
                            type="text"
                            inputMode="numeric"
                            value={formatInputValue(form.ingresoTransferencias)}
                            onChange={(e) => {
                              const parsed = parseInputValue(e.target.value);
                              setForm((prev) => ({ ...prev, ingresoTransferencias: parsed }));
                            }}
                            className="grow bg-transparent"
                            placeholder="0"
                          />
                        </label>
                      </div>
                      <div className="form-control">
                        <label className="label py-1">
                          <span className="label-text flex items-center gap-1.5 text-sm font-medium">
                            <Wallet className="h-4 w-4" />
                            Efectivo
                          </span>
                        </label>
                        <label className="input input-bordered input-sm flex items-center gap-2">
                          <span className="text-base-content/60">$</span>
                          <input
                            type="text"
                            inputMode="numeric"
                            value={formatInputValue(form.ingresoEfectivo)}
                            onChange={(e) => {
                              const parsed = parseInputValue(e.target.value);
                              setForm((prev) => ({ ...prev, ingresoEfectivo: parsed }));
                            }}
                            className="grow bg-transparent"
                            placeholder="0"
                          />
                        </label>
                      </div>
                    </div>
                  </div>
                </div>

                {/* PASO 1B: Gastos y Ajustes */}
                <div className="card bg-error/5 border-error/20 border">
                  <div className="card-body gap-4">
                    <div className="flex items-center gap-2">
                      <TrendingDown className="text-error h-5 w-5" />
                      <h3 className="text-base-content text-base font-semibold">Gastos y Ajustes</h3>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="form-control">
                        <label className="label py-1">
                          <span className="label-text text-sm font-medium">Gastos diarios</span>
                        </label>
                        <label className="input input-bordered input-sm flex items-center gap-2">
                          <span className="text-base-content/60">$</span>
                          <input
                            type="text"
                            inputMode="numeric"
                            value={formatInputValue(form.gastosDiarios)}
                            onChange={(e) => {
                              const parsed = parseInputValue(e.target.value);
                              setForm((prev) => ({ ...prev, gastosDiarios: parsed }));
                            }}
                            className="grow bg-transparent"
                            placeholder="0"
                          />
                        </label>
                        <label className="label py-0">
                          <span className="label-text-alt text-base-content/60">Combustible, insumos, etc.</span>
                        </label>
                      </div>
                      <div className="form-control">
                        <label className="label py-1">
                          <span className="label-text text-sm font-medium">Otros abonos</span>
                        </label>
                        <label className="input input-bordered input-sm flex items-center gap-2">
                          <span className="text-base-content/60">$</span>
                          <input
                            type="text"
                            inputMode="numeric"
                            value={formatInputValue(form.otrosAbonos)}
                            onChange={(e) => {
                              const parsed = parseInputValue(e.target.value);
                              setForm((prev) => ({ ...prev, otrosAbonos: parsed }));
                            }}
                            className="grow bg-transparent"
                            placeholder="0"
                          />
                        </label>
                        <label className="label py-0">
                          <span className="label-text-alt text-base-content/60">Devoluciones, ajustes</span>
                        </label>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Resumen Método de Pago */}
                <div className="card bg-base-200 border-base-300 border-2">
                  <div className="card-body">
                    <div className="mb-2 flex items-center gap-2">
                      <h3 className="text-base-content text-sm font-bold tracking-wide uppercase">
                        Total por Método de Pago
                      </h3>
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="text-center">
                        <p className="text-base-content/60 mb-1 text-xs">Subtotal</p>
                        <p className="text-success text-lg font-bold">{currencyFormatter.format(derived.subtotal)}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-base-content/60 mb-1 text-xs">- Gastos</p>
                        <p className="text-error text-lg font-bold">
                          -{currencyFormatter.format(parseNumber(form.gastosDiarios))}
                        </p>
                      </div>
                      <div className="text-center">
                        <p className="text-base-content/60 mb-1 text-xs font-semibold">TOTAL</p>
                        <p className="text-primary text-2xl font-bold">
                          {currencyFormatter.format(paymentMethodTotal)}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* PASO 2: Ingresos por Tipo de Servicio */}
                <div className="card bg-info/5 border-info/20 border-2">
                  <div className="card-body gap-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="badge badge-lg badge-info font-bold">2</div>
                        <div>
                          <h3 className="text-base-content text-lg font-bold">Ingresos por Tipo de Servicio</h3>
                          <p className="text-base-content/60 text-xs">
                            ¿Qué servicios generaron ingresos? (montos en $)
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                      <div className="form-control">
                        <label className="label py-1">
                          <span className="label-text text-sm font-medium">Consultas</span>
                        </label>
                        <label className="input input-bordered input-sm flex items-center gap-2">
                          <span className="text-base-content/60">$</span>
                          <input
                            type="text"
                            inputMode="numeric"
                            value={formatInputValue(form.consultas)}
                            onChange={(e) => {
                              const parsed = parseInputValue(e.target.value);
                              setForm((prev) => ({ ...prev, consultas: parsed }));
                            }}
                            className="grow bg-transparent"
                            placeholder="0"
                          />
                        </label>
                      </div>
                      <div className="form-control">
                        <label className="label py-1">
                          <span className="label-text text-sm font-medium">Controles</span>
                        </label>
                        <label className="input input-bordered input-sm flex items-center gap-2">
                          <span className="text-base-content/60">$</span>
                          <input
                            type="text"
                            inputMode="numeric"
                            value={formatInputValue(form.controles)}
                            onChange={(e) => {
                              const parsed = parseInputValue(e.target.value);
                              setForm((prev) => ({ ...prev, controles: parsed }));
                            }}
                            className="grow bg-transparent"
                            placeholder="0"
                          />
                        </label>
                      </div>
                      {/* Test field hidden per user request */}
                      <div className="form-control">
                        <label className="label py-1">
                          <span className="label-text flex items-center gap-1.5 text-sm font-medium">
                            <Syringe className="h-3.5 w-3.5" />
                            Vacunas
                          </span>
                        </label>
                        <label className="input input-bordered input-sm flex items-center gap-2">
                          <span className="text-base-content/60">$</span>
                          <input
                            type="text"
                            inputMode="numeric"
                            value={formatInputValue(form.vacunas)}
                            onChange={(e) => {
                              const parsed = parseInputValue(e.target.value);
                              setForm((prev) => ({ ...prev, vacunas: parsed }));
                            }}
                            className="grow bg-transparent"
                            placeholder="0"
                          />
                        </label>
                      </div>
                      <div className="form-control">
                        <label className="label py-1">
                          <span className="label-text flex items-center gap-1.5 text-sm font-medium">
                            <FileText className="h-3.5 w-3.5" />
                            Licencias
                          </span>
                        </label>
                        <label className="input input-bordered input-sm flex items-center gap-2">
                          <span className="text-base-content/60">$</span>
                          <input
                            type="text"
                            inputMode="numeric"
                            value={formatInputValue(form.licencias)}
                            onChange={(e) => {
                              const parsed = parseInputValue(e.target.value);
                              setForm((prev) => ({ ...prev, licencias: parsed }));
                            }}
                            className="grow bg-transparent"
                            placeholder="0"
                          />
                        </label>
                      </div>
                      <div className="form-control">
                        <label className="label py-1">
                          <span className="label-text text-sm font-medium">Roxair</span>
                        </label>
                        <label className="input input-bordered input-sm flex items-center gap-2">
                          <span className="text-base-content/60">$</span>
                          <input
                            type="text"
                            inputMode="numeric"
                            value={formatInputValue(form.roxair)}
                            onChange={(e) => {
                              const parsed = parseInputValue(e.target.value);
                              setForm((prev) => ({ ...prev, roxair: parsed }));
                            }}
                            className="grow bg-transparent"
                            placeholder="0"
                          />
                        </label>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Resumen Tipo de Servicio + Validación */}
                <div className="card bg-base-200 border-base-300 border-2">
                  <div className="card-body">
                    <h3 className="text-base-content mb-2 text-sm font-bold tracking-wide uppercase">
                      Total por Tipo de Servicio
                    </h3>
                    <div className="mb-4 text-center">
                      <p className="text-base-content/60 mb-1 text-xs font-semibold">TOTAL</p>
                      <p className="text-info text-2xl font-bold">{currencyFormatter.format(serviceTotals)}</p>
                    </div>

                    {/* Validation Alert */}
                    {hasDifference ? (
                      <div className="alert alert-warning text-sm">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          fill="none"
                          viewBox="0 0 24 24"
                          className="h-5 w-5 shrink-0 stroke-current"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                          ></path>
                        </svg>
                        <div>
                          <div className="font-bold">⚠️ Los totales no coinciden</div>
                          <div className="text-xs">
                            Diferencia: {currencyFormatter.format(Math.abs(difference))} (
                            {difference > 0 ? "servicios superan pagos" : "pagos superan servicios"})
                            {form.status === "FINAL" && (
                              <span className="ml-2 font-semibold">
                                • Considera dejarlo en BORRADOR hasta verificar
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="alert alert-success text-sm">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-5 w-5 shrink-0 stroke-current"
                          fill="none"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                          />
                        </svg>
                        <div>
                          <span className="font-bold">✓ Totales coinciden perfectamente</span>
                          <span className="ml-2 text-xs">• Puedes marcarlo como CERRADO cuando esté listo</span>
                        </div>
                      </div>
                    )}

                    <div className="divider my-2"></div>

                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-base-content/60 mb-1 text-xs">Por Método de Pago</p>
                        <p className="text-primary font-bold">{currencyFormatter.format(paymentMethodTotal)}</p>
                      </div>
                      <div>
                        <p className="text-base-content/60 mb-1 text-xs">Por Tipo de Servicio</p>
                        <p className="text-info font-bold">{currencyFormatter.format(serviceTotals)}</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Notas Card */}
                <div className="card bg-base-100 border-base-300 border">
                  <div className="card-body gap-4">
                    <div className="flex items-center gap-2">
                      <ClipboardList className="text-base-content/60 h-5 w-5" />
                      <h3 className="text-base-content text-base font-semibold">Notas y Observaciones</h3>
                    </div>
                    <div className="space-y-3">
                      <Input
                        label="Comentarios"
                        as="textarea"
                        rows={2}
                        value={form.comentarios}
                        onChange={handleChange("comentarios")}
                        helper="Notas internas sobre el día"
                      />
                      {selectedId && (
                        <Input
                          label="Motivo del cambio"
                          as="textarea"
                          rows={2}
                          value={form.reason}
                          onChange={handleChange("reason")}
                          helper="Requerido para auditoría"
                        />
                      )}
                    </div>
                  </div>
                </div>

                {/* Guardar */}
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="ghost" onClick={() => setSelectedDate(null)}>
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={mutation.isPending} size="lg" className="gap-2">
                    <Save className="h-5 w-5" />
                    {mutation.isPending ? "Guardando..." : selectedId ? "Actualizar Balance" : "Registrar Balance"}
                  </Button>
                </div>
              </form>
            </div>
          )}

          {selectedId && (
            <div className="space-y-4">
              <div className="card bg-base-100 sticky top-6 h-fit shadow-md">
                <div className="card-body">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <History className="text-base-content/60 h-5 w-5" />
                      <h3 className="text-base-content text-lg font-semibold">Historial</h3>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => historyQuery.refetch()}
                      disabled={historyQuery.isFetching}
                    >
                      Refrescar
                    </Button>
                  </div>
                  <p className="text-base-content/60 text-xs">Auditoría de cambios</p>
                  <div className="mt-4">
                    {historyQuery.isLoading ? (
                      <div className="text-base-content/60 py-8 text-center text-sm">Cargando...</div>
                    ) : historyQuery.error ? (
                      <Alert variant="error">Error al cargar historial</Alert>
                    ) : !historyQuery.data?.length ? (
                      <div className="py-8 text-center">
                        <p className="text-base-content/60 text-sm">Primer registro</p>
                      </div>
                    ) : (
                      <ul className="max-h-[600px] space-y-2 overflow-y-auto">
                        {historyQuery.data.map((entry) => (
                          <li key={entry.id} className="card bg-base-200 p-3">
                            <div className="mb-1 flex items-start justify-between gap-2">
                              <p className="text-base-content text-sm font-medium">
                                {entry.changedByEmail?.split("@")[0] || "Sistema"}
                              </p>
                              <span className="text-base-content/50 text-xs">
                                {dayjs(entry.createdAt).format("DD/MM HH:mm")}
                              </span>
                            </div>
                            {entry.changeReason && (
                              <p className="text-base-content/70 mb-1 text-xs italic">
                                &quot;{entry.changeReason}&quot;
                              </p>
                            )}
                            {entry.snapshot && (
                              <p className="text-primary text-xs font-semibold">
                                Total: {currencyFormatter.format(entry.snapshot.total)}
                              </p>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
