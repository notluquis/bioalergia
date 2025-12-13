import { useMemo, useState, useEffect } from "react";
import type { FormEvent, ReactNode } from "react";
import dayjs from "dayjs";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Button from "@/components/ui/Button";
import Alert from "@/components/ui/Alert";
import { INPUT_CURRENCY_SM, GRID_2_COL_SM, PAGE_CONTAINER } from "@/lib/styles";
import { today } from "@/lib/dates";
import { useToast } from "@/context/ToastContext";
import { useSettings } from "@/context/SettingsContext";
import { CreditCard, Banknote, Wallet, TrendingDown, FileText, ClipboardList, Save, History } from "lucide-react";
import {
  fetchProductionBalanceHistory,
  fetchProductionBalances,
  saveProductionBalance,
} from "@/features/dailyProductionBalances/api";
import type {
  ProductionBalancePayload,
  ProductionBalanceStatus,
  ProductionBalanceHistoryEntry,
} from "@/features/dailyProductionBalances/types";
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
  date: date || today(),
  status: "DRAFT",
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
  const numericValue = value.replace(/[^0-9-]/g, "");
  if (!numericValue || numericValue === "-") return "";
  const parsed = parseInt(numericValue, 10);
  if (Number.isNaN(parsed)) return "";
  return new Intl.NumberFormat("es-CL").format(parsed);
}

function parseInputValue(value: string): string {
  return value.replace(/[^0-9-]/g, "");
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

  const [currentDate, setCurrentDate] = useState(dayjs());
  const [selectedDate, setSelectedDate] = useState<string | null>(today());
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

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    mutation.mutate();
  };

  return (
    <section className={`${PAGE_CONTAINER} space-y-6 p-4`}>
      <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-base-content/70 text-xs tracking-wide uppercase">Balances diarios</p>
          <h1 className="text-base-content text-2xl font-bold">Producción y cobros</h1>
          <p className="text-base-content/60 text-sm">
            Registra ingresos por método de pago y por servicio. Verifica que ambos totales coincidan antes de cerrar el
            día.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={() => setCurrentDate(dayjs())}>
            Ir a hoy
          </Button>
        </div>
      </header>

      <div className="card bg-base-100 border shadow-sm">
        <div className="card-body gap-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-base-content/70 text-xs tracking-wide uppercase">Semana seleccionada</p>
              <h3 className="text-base-content text-lg font-bold">
                {startOfWeek.format("DD MMM")} - {endOfWeek.format("DD MMM YYYY")}
              </h3>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={() => setCurrentDate((d) => d.subtract(1, "week"))}>
                ← Semana previa
              </Button>
              <Button size="sm" onClick={() => setCurrentDate((d) => d.add(1, "week"))}>
                Semana siguiente →
              </Button>
            </div>
          </div>
          <WeekView
            currentDate={currentDate}
            onDateChange={setCurrentDate}
            balances={balances}
            onSelectDay={setSelectedDate}
            selectedDate={selectedDate}
          />
        </div>
      </div>

      {selectedDate ? (
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-2">
            <div className="card bg-base-100 border shadow-sm">
              <div className="card-body p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <h2 className="text-base-content text-sm font-bold capitalize">
                      {dayjs(selectedDate).format("ddd D MMM")}
                    </h2>
                    <span className={`badge badge-xs ${form.status === "FINAL" ? "badge-success" : "badge-warning"}`}>
                      {form.status === "FINAL" ? "Final" : "Borrador"}
                    </span>
                    {selectedId && <span className="text-base-content/60 text-xs">#{selectedId}</span>}
                  </div>
                  {canEdit ? (
                    <div className="flex items-center gap-2">
                      <select
                        className="select select-xs"
                        value={form.status}
                        onChange={(e) => {
                          const newStatus = e.target.value as ProductionBalanceStatus;
                          if (newStatus === "FINAL" && hasDifference) {
                            if (!confirm("⚠️ Los totales no coinciden. ¿Estás seguro de marcarlo como cerrado?")) {
                              return;
                            }
                          }
                          setForm((prev) => ({ ...prev, status: newStatus }));
                        }}
                      >
                        <option value="DRAFT">Borrador</option>
                        <option value="FINAL">Final</option>
                      </select>
                      <Button type="button" variant="ghost" size="xs" onClick={() => setSelectedDate(null)}>
                        Limpiar
                      </Button>
                    </div>
                  ) : (
                    <span className="badge badge-ghost badge-sm">Solo lectura</span>
                  )}
                </div>
              </div>
            </div>

            {canEdit ? (
              <form className="space-y-4" onSubmit={handleSubmit}>
                <div className="alert alert-info text-xs">
                  <strong>Flujo:</strong> 1) Método de pago → 2) Servicios → 3) Valida totales → 4) Guarda.
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-3">
                    <div className="border-success/30 bg-success/5 rounded-2xl border p-4">
                      <div className="flex items-center gap-2">
                        <div className="badge badge-lg badge-success font-bold">1</div>
                        <div>
                          <h3 className="text-base-content text-lg font-bold">Ingresos por método de pago</h3>
                          <p className="text-base-content/60 text-xs">Tarjeta, transferencia y efectivo</p>
                        </div>
                      </div>
                      <div className="mt-3 grid gap-3 sm:grid-cols-3">
                        <MoneyInput
                          icon={<CreditCard className="h-4 w-4" />}
                          label="Tarjetas"
                          value={form.ingresoTarjetas}
                          onChange={(v) => setForm((prev) => ({ ...prev, ingresoTarjetas: v }))}
                        />
                        <MoneyInput
                          icon={<Banknote className="h-4 w-4" />}
                          label="Transferencias"
                          value={form.ingresoTransferencias}
                          onChange={(v) => setForm((prev) => ({ ...prev, ingresoTransferencias: v }))}
                        />
                        <MoneyInput
                          icon={<Wallet className="h-4 w-4" />}
                          label="Efectivo"
                          value={form.ingresoEfectivo}
                          onChange={(v) => setForm((prev) => ({ ...prev, ingresoEfectivo: v }))}
                        />
                      </div>
                    </div>

                    <div className="border-error/30 bg-error/5 rounded-2xl border p-4">
                      <div className="flex items-center gap-2">
                        <TrendingDown className="text-error h-5 w-5" />
                        <h3 className="text-base-content text-base font-semibold">Gastos y ajustes</h3>
                      </div>
                      <div className={GRID_2_COL_SM}>
                        <MoneyInput
                          label="Gastos diarios"
                          value={form.gastosDiarios}
                          onChange={(v) => setForm((prev) => ({ ...prev, gastosDiarios: v }))}
                          hint="Combustible, insumos, etc."
                        />
                        <MoneyInput
                          label="Otros abonos"
                          value={form.otrosAbonos}
                          onChange={(v) => setForm((prev) => ({ ...prev, otrosAbonos: v }))}
                          hint="Devoluciones, ajustes"
                        />
                      </div>
                    </div>

                    <div className="border-base-300 bg-base-50 rounded-2xl border p-4">
                      <h3 className="text-base-content text-sm font-bold">Total por método</h3>
                      <div className="mt-2 grid grid-cols-3 gap-3 text-center text-xs">
                        <StatMini label="Subtotal" value={currencyFormatter.format(derived.subtotal)} tone="success" />
                        <StatMini
                          label="- Gastos"
                          value={`-${currencyFormatter.format(parseNumber(form.gastosDiarios))}`}
                          tone="error"
                        />
                        <StatMini
                          label="Total"
                          value={currencyFormatter.format(paymentMethodTotal)}
                          tone="primary"
                          bold
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="border-info/30 bg-info/5 rounded-2xl border p-4">
                      <div className="flex items-center gap-2">
                        <div className="badge badge-lg badge-info font-bold">2</div>
                        <div>
                          <h3 className="text-base-content text-lg font-bold">Ingresos por servicio</h3>
                          <p className="text-base-content/60 text-xs">Registra los servicios del día</p>
                        </div>
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
                        <MoneyInput
                          label="Consultas"
                          value={form.consultas}
                          onChange={(v) => setForm((prev) => ({ ...prev, consultas: v }))}
                        />
                        <MoneyInput
                          label="Controles"
                          value={form.controles}
                          onChange={(v) => setForm((prev) => ({ ...prev, controles: v }))}
                        />
                        <MoneyInput
                          label="Tests"
                          value={form.tests}
                          onChange={(v) => setForm((prev) => ({ ...prev, tests: v }))}
                        />
                        <MoneyInput
                          label="Vacunas"
                          value={form.vacunas}
                          onChange={(v) => setForm((prev) => ({ ...prev, vacunas: v }))}
                        />
                        <MoneyInput
                          label="Licencias"
                          value={form.licencias}
                          onChange={(v) => setForm((prev) => ({ ...prev, licencias: v }))}
                        />
                        <MoneyInput
                          label="Roxair"
                          value={form.roxair}
                          onChange={(v) => setForm((prev) => ({ ...prev, roxair: v }))}
                        />
                      </div>
                    </div>

                    <div className="border-primary/30 bg-base-100 rounded-2xl border p-4">
                      <div className="flex items-center gap-2">
                        <ClipboardList className="text-primary h-5 w-5" />
                        <h3 className="text-base-content text-base font-semibold">Validación</h3>
                      </div>
                      <div className="mt-3 grid gap-3 sm:grid-cols-2">
                        <StatMini
                          label="Total método de pago"
                          value={currencyFormatter.format(paymentMethodTotal)}
                          tone="primary"
                          bold
                        />
                        <StatMini
                          label="Total servicios"
                          value={currencyFormatter.format(serviceTotals)}
                          tone="primary"
                          bold
                        />
                        <div className="sm:col-span-2">
                          <div
                            className={`alert ${hasDifference ? "alert-error" : "alert-success"} items-center p-3 text-xs`}
                          >
                            <div className="flex flex-col gap-1">
                              <span className="font-semibold">
                                {hasDifference ? "⚠️ Totales no coinciden" : "✅ Totales cuadran"}
                              </span>
                              <span className="text-base-content/70">
                                Diferencia: {currencyFormatter.format(difference)}
                              </span>
                            </div>
                            <label className="label cursor-pointer gap-2 p-0">
                              <span className="text-base-content/70 text-xs">Marcar como final</span>
                              <input
                                type="checkbox"
                                className="toggle toggle-sm"
                                checked={form.status === "FINAL"}
                                onChange={(e) => {
                                  const nextStatus = e.target.checked ? "FINAL" : "DRAFT";
                                  if (nextStatus === "FINAL" && hasDifference) {
                                    if (
                                      !confirm("⚠️ Los totales no coinciden. ¿Estás seguro de marcarlo como cerrado?")
                                    ) {
                                      return;
                                    }
                                  }
                                  setForm((prev) => ({ ...prev, status: nextStatus }));
                                }}
                              />
                            </label>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-base-100 rounded-2xl border p-4">
                  <div className="flex items-center gap-2">
                    <FileText className="text-base-content/70 h-5 w-5" />
                    <h3 className="text-base-content text-sm font-semibold">Notas (opcional)</h3>
                  </div>
                  <div className="mt-3 grid gap-3">
                    <textarea
                      className="textarea textarea-bordered h-20"
                      value={form.comentarios}
                      onChange={(e) => setForm((prev) => ({ ...prev, comentarios: e.target.value }))}
                      placeholder="Notas sobre ingresos, incidencias, etc."
                    />
                    <input
                      className="input input-bordered"
                      value={form.reason}
                      onChange={(e) => setForm((prev) => ({ ...prev, reason: e.target.value }))}
                      placeholder="Motivo de edición (requerido si finalizado)"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button type="submit" variant="primary" disabled={mutation.isPending}>
                    <Save className="h-4 w-4" />
                    {mutation.isPending ? "Guardando..." : "Guardar balance"}
                  </Button>
                  {selectedId && (
                    <Button
                      type="button"
                      variant="secondary"
                      disabled={historyQuery.isLoading}
                      onClick={() => historyQuery.refetch()}
                    >
                      <History className="h-4 w-4" />
                      Ver historial
                    </Button>
                  )}
                  {mutation.isError && <Alert variant="error">No se pudo guardar el balance.</Alert>}
                  {mutation.isSuccess && <Alert variant="success">Balance guardado.</Alert>}
                </div>
              </form>
            ) : (
              <div className="alert alert-info">
                No tienes permisos para editar. Selecciona otro día o contacta a un administrador.
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div className="card bg-base-100 border shadow-sm">
              <div className="card-body p-4">
                <p className="text-base-content/70 text-xs tracking-wide uppercase">Totales de la semana</p>
                <h3 className="text-base-content text-lg font-bold">{startOfWeek.format("YYYY [Semana] WW")}</h3>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <StatMini
                    label="Método de pago"
                    value={currencyFormatter.format(derived.total)}
                    tone="primary"
                    bold
                  />
                  <StatMini label="Servicios" value={currencyFormatter.format(serviceTotals)} tone="primary" bold />
                  <StatMini
                    label="Gastos"
                    value={`-${currencyFormatter.format(parseNumber(form.gastosDiarios))}`}
                    tone="error"
                  />
                  <StatMini label="Otros abonos" value={currencyFormatter.format(parseNumber(form.otrosAbonos))} />
                </div>
              </div>
            </div>

            {selectedId && (
              <div className="card bg-base-100 border shadow-sm">
                <div className="card-body p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-base-content/70 text-xs tracking-wide uppercase">Historial de cambios</p>
                      <h3 className="text-base-content text-lg font-bold">Balance #{selectedId}</h3>
                    </div>
                    <Button size="sm" onClick={() => historyQuery.refetch()} disabled={historyQuery.isLoading}>
                      {historyQuery.isLoading ? "Cargando..." : "Refrescar"}
                    </Button>
                  </div>
                  {historyQuery.data && historyQuery.data.length > 0 ? (
                    <ul className="mt-3 space-y-2 text-sm">
                      {historyQuery.data.map((entry) => (
                        <HistoryItem key={entry.id} entry={entry} currencyFormatter={currencyFormatter} />
                      ))}
                    </ul>
                  ) : (
                    <p className="text-base-content/60 mt-2 text-sm">Sin historial para este balance.</p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="alert alert-info">Selecciona un día en el calendario para editar o revisar el balance.</div>
      )}
    </section>
  );
}

function HistoryItem({
  entry,
  currencyFormatter,
}: {
  entry: ProductionBalanceHistoryEntry;
  currencyFormatter: Intl.NumberFormat;
}) {
  const status = entry.snapshot?.status ?? "DRAFT";
  const badgeTone = status === "FINAL" ? "badge-success" : "badge-warning";
  return (
    <li className="border-base-200 rounded-lg border p-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-base-content font-semibold">{dayjs(entry.createdAt).format("DD MMM YYYY HH:mm")}</p>
          <p className="text-base-content/60 text-xs">Por: {entry.changedByEmail || "Desconocido"}</p>
        </div>
        <span className={`badge ${badgeTone} badge-sm`}>{status}</span>
      </div>
      {entry.snapshot && (
        <p className="text-base-content/70 mt-2 text-xs">
          Snapshot: Ingresos {currencyFormatter.format(entry.snapshot.ingresoTarjetas)} tarjetas,{" "}
          {currencyFormatter.format(entry.snapshot.ingresoTransferencias)} transferencias,{" "}
          {currencyFormatter.format(entry.snapshot.ingresoEfectivo)} efectivo.
        </p>
      )}
      {entry.changeReason && <p className="text-base-content/70 mt-1 text-xs">Motivo: {entry.changeReason}</p>}
    </li>
  );
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

function MoneyInput({
  icon,
  label,
  value,
  onChange,
  hint,
}: {
  icon?: ReactNode;
  label: string;
  value: string;
  onChange: (next: string) => void;
  hint?: string;
}) {
  return (
    <div className="form-control">
      <label className="label py-1">
        <span className="label-text flex items-center gap-1.5 text-sm font-medium">
          {icon}
          {label}
        </span>
      </label>
      <label className={INPUT_CURRENCY_SM}>
        <span className="text-base-content/60">$</span>
        <input
          type="text"
          inputMode="numeric"
          value={formatInputValue(value)}
          onChange={(e) => onChange(parseInputValue(e.target.value))}
          className="grow bg-transparent"
          placeholder="0"
        />
      </label>
      {hint && <span className="text-base-content/60 mt-1 text-xs">{hint}</span>}
    </div>
  );
}

function StatMini({
  label,
  value,
  tone,
  bold,
}: {
  label: string;
  value: string;
  tone?: "primary" | "success" | "error";
  bold?: boolean;
}) {
  const toneClass =
    tone === "primary" ? "text-primary" : tone === "success" ? "text-success" : tone === "error" ? "text-error" : "";
  return (
    <div className="border-base-200 bg-base-100 rounded-lg border p-3 text-center">
      <p className="text-base-content/60 text-xs">{label}</p>
      <p className={`${toneClass} ${bold ? "text-lg font-bold" : "text-sm font-semibold"}`}>{value}</p>
    </div>
  );
}
