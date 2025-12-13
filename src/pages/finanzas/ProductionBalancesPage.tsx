import { useMemo, useState, useEffect } from "react";
import type { FormEvent, ReactNode } from "react";
import dayjs from "dayjs";
import "dayjs/locale/es"; // Import Spanish locale
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Button from "@/components/ui/Button";
import Alert from "@/components/ui/Alert";
import { INPUT_CURRENCY_SM } from "@/lib/styles";
import { today } from "@/lib/dates";
import { useToast } from "@/context/ToastContext";
// import { useSettings } from "@/context/SettingsContext";
import { CreditCard, Banknote, Wallet, TrendingDown, FileText, ClipboardList, Save, MoreVertical } from "lucide-react";
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
import { fmtCLP, coerceAmount, numberFormatter } from "@/lib/format";

// Ensure Spanish locale is used for correct week start (Monday)
dayjs.locale("es");

export default function DailyProductionBalancesPage() {
  const { user } = useAuth();
  const { success: toastSuccess, error: toastError } = useToast();
  const queryClient = useQueryClient();
  // Settings unused

  // Simple role-based access for now (matching sidebar)
  const canView = true; // If they can reach this page, they can view
  const canEdit = ["GOD", "ADMIN", "ANALYST"].includes(user?.role || "");

  const [currentDate, setCurrentDate] = useState(dayjs());
  const [selectedDate, setSelectedDate] = useState<string | null>(today());
  // Fix: With 'es' locale, startOf('week') is Monday. Do NOT add 1 day.
  const startOfWeek = currentDate.locale("es").startOf("week");
  const endOfWeek = startOfWeek.add(6, "day"); // Ends on Sunday if 7 days, but we render 6 days in WeekView
  const todayDate = dayjs();
  const nextWeekStart = startOfWeek.add(7, "day");
  const canGoNextWeek = !nextWeekStart.isAfter(todayDate, "day");
  const from = startOfWeek.format("YYYY-MM-DD");
  const to = endOfWeek.format("YYYY-MM-DD");

  const [form, setForm] = useState<FormState>(() => makeDefaultForm());
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const handleGoToday = () => {
    const now = dayjs();
    const todayStr = now.format("YYYY-MM-DD");
    setCurrentDate(now);
    setSelectedDate(todayStr);
    setSelectedId(null);
    setShowHistory(false);
    setForm(makeDefaultForm(todayStr));
  };

  const balancesQuery = useQuery({
    queryKey: ["production-balances", from, to],
    queryFn: () => fetchProductionBalances(from, to),
    enabled: canView,
  });

  const historyQuery = useQuery({
    queryKey: ["production-balance-history", selectedId],
    enabled: selectedId != null && showHistory && canView,
    queryFn: () => fetchProductionBalanceHistory(selectedId ?? 0),
  });

  const mutation = useMutation({
    mutationFn: async (payload: ProductionBalancePayload) => {
      return saveProductionBalance(payload, selectedId);
    },
    onSuccess: (saved) => {
      toastSuccess("Balance guardado correctamente");
      setSelectedId(saved.id);
      setForm((prev) => ({ ...prev, status: saved.status, reason: "" }));
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
    const balance = balances.find((b) => b.date === selectedDate || dayjs(b.date).isSame(dayjs(selectedDate), "day"));
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
      setShowHistory(false);
      setForm(makeDefaultForm(selectedDate));
    }
  }, [selectedDate, balances]);

  const existingBalance = selectedDate
    ? balances.find((b) => b.date === selectedDate || dayjs(b.date).isSame(dayjs(selectedDate), "day"))
    : null;
  const wasFinal = existingBalance?.status === "FINAL";

  const derived = deriveTotals({
    ingresoTarjetas: coerceAmount(form.ingresoTarjetas),
    ingresoTransferencias: coerceAmount(form.ingresoTransferencias),
    ingresoEfectivo: coerceAmount(form.ingresoEfectivo),
    gastosDiarios: coerceAmount(form.gastosDiarios),
  });

  const serviceTotals =
    coerceAmount(form.consultas) +
    coerceAmount(form.controles) +
    coerceAmount(form.tests) +
    coerceAmount(form.vacunas) +
    coerceAmount(form.licencias) +
    coerceAmount(form.roxair) +
    coerceAmount(form.otrosAbonos);

  const paymentMethodTotal = derived.total;
  const hasDifference = serviceTotals !== paymentMethodTotal;
  const difference = serviceTotals - paymentMethodTotal;

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canEdit) return;
    triggerSave({ forceFinal: false });
  };

  const triggerSave = (options?: { forceFinal?: boolean }) => {
    if (!canEdit) return;
    const forceFinal = options?.forceFinal ?? false;
    if (forceFinal && hasDifference) {
      const confirmed = confirm("⚠️ Los totales no coinciden. ¿Estás seguro de marcarlo como cerrado?");
      if (!confirmed) return;
    }

    if (forceFinal && form.status !== "FINAL") {
      setForm((prev) => ({ ...prev, status: "FINAL" }));
    }

    const payload = toPayload({ ...form, status: forceFinal ? "FINAL" : form.status });
    mutation.mutate(payload);
  };

  if (!canView) {
    return (
      <section className="mx-auto w-full max-w-none space-y-6 p-4">
        <Alert variant="error">No tienes permisos para ver balances de producción.</Alert>
      </section>
    );
  }

  return (
    <section className="mx-auto w-full max-w-none space-y-6 p-4">
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
          <Button size="sm" onClick={handleGoToday}>
            Ir a hoy
          </Button>
        </div>
      </header>

      <div className="card bg-base-100 border-base-200 border shadow-sm">
        <div className="card-body gap-3 p-4 sm:p-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-base-content/70 text-xs tracking-wide uppercase">Semana seleccionada</p>
              <h3 className="text-base-content text-base font-bold">
                {startOfWeek.format("DD MMM")} - {endOfWeek.format("DD MMM YYYY")}
              </h3>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={() => setCurrentDate((d) => d.subtract(1, "week"))}>
                ← Semana previa
              </Button>
              <Button
                size="sm"
                disabled={!canGoNextWeek}
                onClick={() => {
                  if (!canGoNextWeek) return;
                  setCurrentDate((d) => d.add(1, "week"));
                }}
              >
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
        <div className="space-y-4">
          <div className="card bg-base-100 border-base-200 border shadow-sm">
            <div className="card-body p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <h2 className="text-base-content text-xl font-bold capitalize">
                    {dayjs(selectedDate).format("dddd D [de] MMMM")}
                  </h2>
                  <span
                    className={`badge ${
                      form.status === "FINAL"
                        ? "badge-success text-success-content"
                        : "badge-warning text-warning-content"
                    } font-medium`}
                  >
                    {form.status === "FINAL" ? "Finalizado" : "Borrador"}
                  </span>
                  {selectedId && <span className="text-base-content/40 font-mono text-xs">#{selectedId}</span>}
                </div>
                <div className="flex items-center gap-2">
                  {canEdit && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        if (confirm("¿Estás seguro de limpiar todos los campos?")) {
                          setForm(makeDefaultForm(selectedDate));
                          setSelectedId(null);
                        }
                      }}
                      className="text-base-content/70 hover:text-error hover:bg-error/10"
                    >
                      Limpiar formulario
                    </Button>
                  )}
                  {selectedId && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setShowHistory((prev) => !prev)}
                      className="gap-1.5"
                      aria-label="Historial de cambios"
                    >
                      <MoreVertical className="h-4 w-4" />
                      <span className="hidden sm:inline">Historial</span>
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>

          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="grid gap-4 lg:grid-cols-12">
              <div className="space-y-3 lg:col-span-5 xl:col-span-5">
                <div className="border-success/30 bg-success/5 rounded-2xl border p-4 shadow-sm">
                  <div className="flex items-center gap-2">
                    <div className="badge badge-lg badge-success font-bold">1</div>
                    <div>
                      <h3 className="text-base-content text-lg font-bold">Ingresos por método de pago</h3>
                      <p className="text-base-content/60 text-xs">Tarjeta, transferencia y efectivo</p>
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <MoneyInput
                      icon={<CreditCard className="h-4 w-4" />}
                      label="Tarjetas"
                      value={form.ingresoTarjetas}
                      onChange={(v) => setForm((prev) => ({ ...prev, ingresoTarjetas: v }))}
                      disabled={!canEdit}
                    />
                    <MoneyInput
                      icon={<Banknote className="h-4 w-4" />}
                      label="Transferencias"
                      value={form.ingresoTransferencias}
                      onChange={(v) => setForm((prev) => ({ ...prev, ingresoTransferencias: v }))}
                      disabled={!canEdit}
                    />
                    <MoneyInput
                      icon={<Wallet className="h-4 w-4" />}
                      label="Efectivo"
                      value={form.ingresoEfectivo}
                      onChange={(v) => setForm((prev) => ({ ...prev, ingresoEfectivo: v }))}
                      disabled={!canEdit}
                    />
                  </div>
                </div>

                <div className="border-error/30 bg-error/5 rounded-2xl border p-4 shadow-sm">
                  <div className="flex items-center gap-2">
                    <TrendingDown className="text-error h-5 w-5" />
                    <h3 className="text-base-content text-base font-semibold">Gastos</h3>
                  </div>
                  <div className="grid grid-cols-1 gap-3">
                    <MoneyInput
                      label="Gastos diarios"
                      value={form.gastosDiarios}
                      onChange={(v) => setForm((prev) => ({ ...prev, gastosDiarios: v }))}
                      hint="Combustible, insumos, etc."
                      disabled={!canEdit}
                    />
                  </div>
                </div>

                <div className="border-base-200 bg-base-50 rounded-2xl border p-4 shadow-sm">
                  <h3 className="text-base-content text-sm font-bold">Total por método</h3>
                  <div className="mt-2 grid grid-cols-3 gap-3 text-center text-xs">
                    <StatMini label="Subtotal" value={fmtCLP(derived.subtotal)} tone="success" />
                    <StatMini label="Gastos" value={`-${fmtCLP(coerceAmount(form.gastosDiarios))}`} tone="error" />
                    <StatMini label="Total" value={fmtCLP(paymentMethodTotal)} tone="primary" bold />
                  </div>
                </div>
              </div>

              <div className="space-y-3 lg:col-span-4 xl:col-span-4">
                <div className="bg-info/5 border-base-200 h-full rounded-2xl border p-4 shadow-sm">
                  <div className="flex items-center gap-2">
                    <div className="badge badge-lg badge-info font-bold">2</div>
                    <div>
                      <h3 className="text-base-content text-lg font-bold">Ingresos por servicio</h3>
                      <p className="text-base-content/60 text-xs">Registra los servicios del día</p>
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <MoneyInput
                      label="Consultas"
                      value={form.consultas}
                      onChange={(v) => setForm((prev) => ({ ...prev, consultas: v }))}
                      disabled={!canEdit}
                    />
                    <MoneyInput
                      label="Controles"
                      value={form.controles}
                      onChange={(v) => setForm((prev) => ({ ...prev, controles: v }))}
                      disabled={!canEdit}
                    />
                    <MoneyInput
                      label="Tests"
                      value={form.tests}
                      onChange={(v) => setForm((prev) => ({ ...prev, tests: v }))}
                      disabled={!canEdit}
                    />
                    <MoneyInput
                      label="Vacunas"
                      value={form.vacunas}
                      onChange={(v) => setForm((prev) => ({ ...prev, vacunas: v }))}
                      disabled={!canEdit}
                    />
                    <MoneyInput
                      label="Licencias"
                      value={form.licencias}
                      onChange={(v) => setForm((prev) => ({ ...prev, licencias: v }))}
                      disabled={!canEdit}
                    />
                    <MoneyInput
                      label="Roxair"
                      value={form.roxair}
                      onChange={(v) => setForm((prev) => ({ ...prev, roxair: v }))}
                      disabled={!canEdit}
                    />
                    <div className="sm:col-span-2">
                      <MoneyInput
                        label="Otros abonos"
                        value={form.otrosAbonos}
                        onChange={(v) => setForm((prev) => ({ ...prev, otrosAbonos: v }))}
                        hint="Devoluciones, ajustes"
                        disabled={!canEdit}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-3 lg:col-span-3 xl:col-span-3">
                <div className="bg-base-100 border-base-200 rounded-2xl border p-4 shadow-sm">
                  <div className="flex items-center gap-2">
                    <FileText className="text-base-content/70 h-5 w-5" />
                    <h3 className="text-base-content text-sm font-semibold">Notas (opcional)</h3>
                  </div>
                  <div className="mt-3 flex flex-col gap-3">
                    <textarea
                      className="textarea textarea-bordered h-28 w-full"
                      value={form.comentarios}
                      onChange={(e) => setForm((prev) => ({ ...prev, comentarios: e.target.value }))}
                      placeholder="Notas sobre ingresos, incidencias, etc."
                      disabled={!canEdit}
                    />
                    {wasFinal && (
                      <input
                        className="input input-bordered w-full"
                        value={form.reason}
                        onChange={(e) => setForm((prev) => ({ ...prev, reason: e.target.value }))}
                        placeholder="Motivo de edición (requerido si finalizado)"
                        disabled={!canEdit}
                      />
                    )}
                  </div>
                </div>

                <div className="bg-base-100 border-base-200 flex flex-col rounded-3xl border p-5 shadow-sm">
                  {/* Header */}
                  <div>
                    <div className="mb-4 flex items-center gap-2">
                      <div className="bg-primary/10 text-primary rounded-xl p-2">
                        <ClipboardList className="h-5 w-5" />
                      </div>
                      <div>
                        <h3 className="text-base-content text-base font-bold">Validación y Cierre</h3>
                        <p className="text-base-content/60 text-xs">Confirma que los totales coincidan</p>
                      </div>
                    </div>

                    {/* Stats */}
                    <div className="mb-4 grid grid-cols-2 gap-2">
                      <div className="bg-base-200/50 hover:bg-base-200 rounded-xl p-2 text-center transition-all">
                        <p className="text-base-content/60 text-[10px] font-semibold tracking-wider uppercase">
                          Métodos
                        </p>
                        <p className="text-primary mt-0.5 text-base font-bold">{fmtCLP(paymentMethodTotal)}</p>
                      </div>
                      <div className="bg-base-200/50 hover:bg-base-200 rounded-xl p-2 text-center transition-all">
                        <p className="text-base-content/60 text-[10px] font-semibold tracking-wider uppercase">
                          Servicios
                        </p>
                        <p className="text-primary mt-0.5 text-base font-bold">{fmtCLP(serviceTotals)}</p>
                      </div>
                    </div>

                    {/* Status Banner */}
                    <div
                      className={`flex flex-col items-center justify-center rounded-2xl p-3 text-center transition-all duration-300 ${
                        hasDifference
                          ? "bg-error/10 text-error ring-error/20 ring-1"
                          : "bg-success/10 text-success ring-success/20 ring-1"
                      }`}
                    >
                      {hasDifference ? (
                        <>
                          <div className="mb-1 flex items-center gap-1">
                            <TrendingDown className="h-5 w-5" />
                            <span className="font-bold">Diferencia</span>
                          </div>
                          <span className="text-xl font-black tracking-tight">{fmtCLP(difference)}</span>
                        </>
                      ) : (
                        <>
                          <div className="mb-1 flex items-center gap-1">
                            <span className="text-lg">✨</span>
                            <span className="font-bold">¡Cuadra!</span>
                          </div>
                          <span className="text-xs font-medium opacity-80">Diferencia: $0</span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Actions Footer */}
                  <div className="border-base-200/60 mt-4 flex flex-col gap-3 border-t pt-4">
                    <div className="flex items-center justify-between gap-3">
                      {/* Status Toggle Removed - Auto managed */}

                      {/* Primary Save Button */}
                      <div className="flex w-full gap-2">
                        {form.status === "FINAL" ? (
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => {
                              if (confirm("¿Reabrir este balance como borrador?")) {
                                setForm((prev) => ({ ...prev, status: "DRAFT" }));
                                triggerSave({ forceFinal: false });
                              }
                            }}
                          >
                            Reabrir como Borrador
                          </Button>
                        ) : (
                          <div className="text-base-content/50 flex items-center px-2 text-xs">
                            <span className="hidden sm:inline">Se guardará como borrador hasta cuadrar.</span>
                          </div>
                        )}

                        <Button
                          type="button"
                          variant="primary"
                          className="shadow-primary/20 grow rounded-xl text-sm font-bold shadow-sm"
                          disabled={mutation.isPending || !canEdit}
                          onClick={() => {
                            if (!hasDifference) {
                              triggerSave({ forceFinal: true });
                            } else {
                              triggerSave({ forceFinal: false });
                            }
                          }}
                        >
                          {mutation.isPending ? (
                            <span className="loading loading-spinner loading-xs"></span>
                          ) : (
                            <>
                              <Save className="h-4 w-4" />
                              {form.status === "FINAL"
                                ? "Guardar cambios"
                                : !hasDifference
                                  ? "Guardar y Finalizar"
                                  : "Guardar Borrador"}
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {mutation.isError && <Alert variant="error">No se pudo guardar el balance.</Alert>}
              {mutation.isSuccess && <Alert variant="success">Balance guardado.</Alert>}
            </div>
          </form>
        </div>
      ) : (
        <div className="alert alert-info">Selecciona un día en el calendario para editar o revisar el balance.</div>
      )}

      {showHistory && selectedId && (
        <div className="bg-base-100 border-base-200 fixed right-4 bottom-4 z-40 w-full max-w-sm rounded-2xl border shadow-lg">
          <div className="border-base-200 flex items-center justify-between border-b px-4 py-2">
            <div>
              <p className="text-base-content/70 text-[11px] tracking-wide uppercase">Historial de cambios</p>
              <h3 className="text-base-content text-sm font-bold">Balance #{selectedId}</h3>
            </div>
            <div className="flex items-center gap-2">
              <Button size="xs" onClick={() => historyQuery.refetch()} disabled={historyQuery.isLoading}>
                {historyQuery.isLoading ? "Cargando..." : "Refrescar"}
              </Button>
              <button
                className="text-base-content/60 hover:text-base-content rounded-full p-1"
                onClick={() => setShowHistory(false)}
                aria-label="Cerrar historial"
              >
                ✕
              </button>
            </div>
          </div>
          <div className="max-h-80 overflow-y-auto px-4 py-3 text-sm">
            {historyQuery.data && historyQuery.data.length > 0 ? (
              <ul className="space-y-2">
                {historyQuery.data.map((entry) => (
                  <HistoryItem key={entry.id} entry={entry} />
                ))}
              </ul>
            ) : (
              <p className="text-base-content/60">Sin historial para este balance.</p>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

function HistoryItem({ entry }: { entry: ProductionBalanceHistoryEntry }) {
  const status = entry.snapshot?.status ?? "DRAFT";
  const badgeTone = status === "FINAL" ? "badge-success" : "badge-warning";
  return (
    <li className="content-auto border-base-200 rounded-lg border p-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-base-content font-semibold">{dayjs(entry.createdAt).format("DD MMM YYYY HH:mm")}</p>
          <p className="text-base-content/60 text-xs">Por: {entry.changedByEmail || "Desconocido"}</p>
        </div>
        <span className={`badge ${badgeTone} badge-sm`}>{status}</span>
      </div>
      {entry.snapshot && (
        <p className="text-base-content/70 mt-2 text-xs">
          Snapshot: Ingresos {fmtCLP(entry.snapshot.ingresoTarjetas)} tarjetas,{" "}
          {fmtCLP(entry.snapshot.ingresoTransferencias)} transferencias, {fmtCLP(entry.snapshot.ingresoEfectivo)}{" "}
          efectivo.
        </p>
      )}
      {entry.changeReason && <p className="text-base-content/70 mt-1 text-xs">Motivo: {entry.changeReason}</p>}
    </li>
  );
}

function toPayload(form: FormState): ProductionBalancePayload {
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
  disabled,
}: {
  icon?: ReactNode;
  label: string;
  value: string;
  onChange: (next: string) => void;
  hint?: string;
  disabled?: boolean;
}) {
  return (
    <div className="form-control">
      <label className="label py-1">
        <span className="label-text flex items-center gap-1.5 text-xs leading-tight font-medium sm:text-sm">
          {icon}
          {label}
        </span>
      </label>
      <label className={INPUT_CURRENCY_SM}>
        <span className="text-base-content/60 text-xs sm:text-sm">$</span>
        <input
          type="text"
          inputMode="numeric"
          value={value ? numberFormatter.format(Number(value)) : ""}
          onChange={(e) => {
            const raw = e.target.value.replace(/[^0-9-]/g, "");
            onChange(raw);
          }}
          className="text-base-content placeholder:text-base-content/40 grow bg-transparent text-xs sm:text-sm md:text-base"
          placeholder="0"
          disabled={disabled}
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

interface FormState {
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

function makeDefaultForm(dateStr?: string): FormState {
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
