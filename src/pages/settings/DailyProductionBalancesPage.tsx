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
  TrendingUp,
  TrendingDown,
  FileText,
  Stethoscope,
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

  const handleChange =
    (key: keyof FormState) => (event: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
      setForm((prev) => ({ ...prev, [key]: event.target.value }));
    };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    mutation.mutate();
  };

  return (
    <section className="space-y-6">
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
              <div className="card bg-base-100 shadow-md">
                <div className="card-body">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <Calendar className="text-primary h-5 w-5" />
                        <h2 className="text-base-content text-xl font-bold">
                          {dayjs(selectedDate).format("dddd D [de] MMMM")}
                        </h2>
                      </div>
                      <p className="text-base-content/60 mt-1 text-sm">
                        {selectedId ? "Editando registro existente" : "Nuevo registro"}
                      </p>
                    </div>
                    <Button type="button" variant="ghost" size="sm" onClick={() => setSelectedDate(null)}>
                      Cerrar
                    </Button>
                  </div>
                </div>
              </div>

              <form className="space-y-4" onSubmit={handleSubmit}>
                {/* Ingresos Card */}
                <div className="card bg-success/5 border-success/20 border">
                  <div className="card-body gap-4">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="text-success h-5 w-5" />
                      <h3 className="text-base-content text-lg font-semibold">Ingresos</h3>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-3">
                      <div className="form-control">
                        <label className="label py-1">
                          <span className="label-text flex items-center gap-1.5 text-sm font-medium">
                            <CreditCard className="h-4 w-4" />
                            Tarjetas
                          </span>
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={form.ingresoTarjetas}
                          onChange={handleChange("ingresoTarjetas")}
                          className="input input-bordered input-sm"
                          placeholder="0"
                        />
                      </div>
                      <div className="form-control">
                        <label className="label py-1">
                          <span className="label-text flex items-center gap-1.5 text-sm font-medium">
                            <Banknote className="h-4 w-4" />
                            Transferencias
                          </span>
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={form.ingresoTransferencias}
                          onChange={handleChange("ingresoTransferencias")}
                          className="input input-bordered input-sm"
                          placeholder="0"
                        />
                      </div>
                      <div className="form-control">
                        <label className="label py-1">
                          <span className="label-text flex items-center gap-1.5 text-sm font-medium">
                            <Wallet className="h-4 w-4" />
                            Efectivo
                          </span>
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={form.ingresoEfectivo}
                          onChange={handleChange("ingresoEfectivo")}
                          className="input input-bordered input-sm"
                          placeholder="0"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Gastos Card */}
                <div className="card bg-error/5 border-error/20 border">
                  <div className="card-body gap-4">
                    <div className="flex items-center gap-2">
                      <TrendingDown className="text-error h-5 w-5" />
                      <h3 className="text-base-content text-lg font-semibold">Gastos y Ajustes</h3>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Input
                        label="Gastos diarios"
                        type="number"
                        value={form.gastosDiarios}
                        onChange={handleChange("gastosDiarios")}
                        min="0"
                        helper="Combustible, insumos, etc."
                      />
                      <Input
                        label="Otros abonos"
                        type="number"
                        value={form.otrosAbonos}
                        onChange={handleChange("otrosAbonos")}
                        min="0"
                        helper="Devoluciones, ajustes"
                      />
                    </div>
                  </div>
                </div>

                {/* Resumen Card */}
                <div className="card bg-primary/5 border-primary/30 border-2">
                  <div className="card-body">
                    <h3 className="text-primary text-sm font-semibold tracking-wide uppercase">Resumen del día</h3>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="text-center">
                        <p className="text-base-content/60 mb-1 text-xs">Subtotal</p>
                        <p className="text-success text-xl font-bold">{currencyFormatter.format(derived.subtotal)}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-base-content/60 mb-1 text-xs">Neto</p>
                        <p className="text-base-content text-xl font-bold">
                          {currencyFormatter.format(derived.totalIngresos)}
                        </p>
                      </div>
                      <div className="text-center">
                        <p className="text-base-content/60 mb-1 text-xs">Total</p>
                        <p className="text-primary text-2xl font-bold">{currencyFormatter.format(derived.total)}</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Actividades Card */}
                <div className="card bg-info/5 border-info/20 border">
                  <div className="card-body gap-4">
                    <div className="flex items-center gap-2">
                      <Stethoscope className="text-info h-5 w-5" />
                      <h3 className="text-base-content text-lg font-semibold">Actividades del día</h3>
                    </div>
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                      <div className="form-control">
                        <label className="label py-1">
                          <span className="label-text text-sm font-medium">Consultas</span>
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={form.consultas}
                          onChange={handleChange("consultas")}
                          className="input input-bordered input-sm"
                          placeholder="0"
                        />
                      </div>
                      <div className="form-control">
                        <label className="label py-1">
                          <span className="label-text text-sm font-medium">Controles</span>
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={form.controles}
                          onChange={handleChange("controles")}
                          className="input input-bordered input-sm"
                          placeholder="0"
                        />
                      </div>
                      <div className="form-control">
                        <label className="label py-1">
                          <span className="label-text text-sm font-medium">Test</span>
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={form.tests}
                          onChange={handleChange("tests")}
                          className="input input-bordered input-sm"
                          placeholder="0"
                        />
                      </div>
                      <div className="form-control">
                        <label className="label py-1">
                          <span className="label-text flex items-center gap-1.5 text-sm font-medium">
                            <Syringe className="h-3.5 w-3.5" />
                            Vacunas
                          </span>
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={form.vacunas}
                          onChange={handleChange("vacunas")}
                          className="input input-bordered input-sm"
                          placeholder="0"
                        />
                      </div>
                      <div className="form-control">
                        <label className="label py-1">
                          <span className="label-text flex items-center gap-1.5 text-sm font-medium">
                            <FileText className="h-3.5 w-3.5" />
                            Licencias
                          </span>
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={form.licencias}
                          onChange={handleChange("licencias")}
                          className="input input-bordered input-sm"
                          placeholder="0"
                        />
                      </div>
                      <div className="form-control">
                        <label className="label py-1">
                          <span className="label-text text-sm font-medium">Roxair</span>
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={form.roxair}
                          onChange={handleChange("roxair")}
                          className="input input-bordered input-sm"
                          placeholder="0"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Notas Card */}
                <div className="card bg-base-100 border-base-300 border">
                  <div className="card-body gap-4">
                    <div className="flex items-center gap-2">
                      <ClipboardList className="text-base-content/60 h-5 w-5" />
                      <h3 className="text-base-content text-lg font-semibold">Notas y Observaciones</h3>
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

                {/* Estado y Guardar */}
                <div className="card bg-base-100 border-base-300 border">
                  <div className="card-body">
                    <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
                      <div className="form-control flex-1">
                        <label className="label py-1">
                          <span className="label-text text-sm font-medium">Estado del balance</span>
                        </label>
                        <select
                          className="select select-bordered"
                          value={form.status}
                          onChange={handleChange("status")}
                        >
                          <option value="FINAL">✓ Final (Cerrado)</option>
                          <option value="DRAFT">⏱ Borrador</option>
                        </select>
                      </div>
                      <Button
                        type="submit"
                        disabled={mutation.isPending}
                        size="lg"
                        className="gap-2 sm:w-auto sm:self-end"
                      >
                        <Save className="h-4 w-4" />
                        {mutation.isPending ? "Guardando..." : selectedId ? "Actualizar" : "Registrar"}
                      </Button>
                    </div>
                  </div>
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
