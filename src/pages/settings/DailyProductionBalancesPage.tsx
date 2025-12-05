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
    <section className="space-y-8">
      <div className="flex flex-col gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-primary">Finanzas · Prestaciones</p>
        <h1 className="text-3xl font-semibold text-base-content drop-shadow-sm">Balance diario de prestaciones</h1>
        <p className="max-w-3xl text-sm text-base-content/70">
          Gestiona los ingresos y prestaciones diarias. Selecciona un día de la semana para registrar o editar su
          balance.
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
          className={`grid gap-6 ${canEdit ? "lg:grid-cols-[1.2fr_0.8fr]" : "lg:grid-cols-1"} animate-in fade-in slide-in-from-bottom-4 duration-500`}
        >
          {canEdit && (
            <div className="rounded-3xl border border-primary/20 bg-base-100/80 p-6 shadow-lg">
              <div className="flex items-center justify-between gap-2 mb-6">
                <div>
                  <p className="text-xs uppercase tracking-wide text-base-content/60">
                    {selectedId ? "Editar balance" : "Nuevo balance"}
                  </p>
                  <h2 className="text-2xl font-semibold text-base-content">
                    {dayjs(selectedDate).format("dddd D [de] MMMM")}
                  </h2>
                </div>
                <div className="flex gap-2">
                  <Button type="button" variant="ghost" onClick={() => setSelectedDate(null)}>
                    Cerrar
                  </Button>
                </div>
              </div>

              <form className="space-y-6" onSubmit={handleSubmit}>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Input label="Fecha" type="date" value={form.date} disabled className="opacity-70" />
                  <Input label="Estado" as="select" value={form.status} onChange={handleChange("status")}>
                    <option value="FINAL">Final (Cerrado)</option>
                    <option value="DRAFT">Borrador (Pendiente)</option>
                  </Input>
                </div>

                <div className="divider text-xs font-bold uppercase text-base-content/40">Finanzas</div>

                <div className="grid gap-4 sm:grid-cols-3">
                  <Input
                    label="Ingreso tarjetas"
                    type="number"
                    value={form.ingresoTarjetas}
                    onChange={handleChange("ingresoTarjetas")}
                    min="0"
                  />
                  <Input
                    label="Ingreso transferencias"
                    type="number"
                    value={form.ingresoTransferencias}
                    onChange={handleChange("ingresoTransferencias")}
                    min="0"
                  />
                  <Input
                    label="Ingreso efectivo"
                    type="number"
                    value={form.ingresoEfectivo}
                    onChange={handleChange("ingresoEfectivo")}
                    min="0"
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <Input
                    label="Gastos diarios"
                    type="number"
                    value={form.gastosDiarios}
                    onChange={handleChange("gastosDiarios")}
                    helper="Combustible, insumos, etc."
                  />
                  <Input
                    label="Otros abonos"
                    type="number"
                    value={form.otrosAbonos}
                    onChange={handleChange("otrosAbonos")}
                    helper="Devoluciones, ajustes o abonos extra"
                  />
                </div>

                <div className="rounded-2xl border border-base-300/60 bg-base-200/60 p-4 text-sm">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xs uppercase tracking-wide text-base-content/60">Resumen Financiero</span>
                  </div>
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <p className="text-xs text-base-content/60">Subtotal Ingresos</p>
                      <p className="font-semibold text-base-content text-lg">
                        {currencyFormatter.format(derived.subtotal)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-base-content/60">Ingresos - Gastos</p>
                      <p className="font-semibold text-base-content text-lg">
                        {currencyFormatter.format(derived.totalIngresos)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-base-content/60">Total Final</p>
                      <p className="font-bold text-primary text-lg">{currencyFormatter.format(derived.total)}</p>
                    </div>
                  </div>
                </div>

                <div className="divider text-xs font-bold uppercase text-base-content/40">Prestaciones</div>

                <div className="grid gap-4 sm:grid-cols-3">
                  <Input
                    label="Consultas"
                    type="number"
                    min="0"
                    value={form.consultas}
                    onChange={handleChange("consultas")}
                  />
                  <Input
                    label="Controles"
                    type="number"
                    min="0"
                    value={form.controles}
                    onChange={handleChange("controles")}
                  />
                  <Input label="Test" type="number" min="0" value={form.tests} onChange={handleChange("tests")} />
                  <Input
                    label="Vacunas"
                    type="number"
                    min="0"
                    value={form.vacunas}
                    onChange={handleChange("vacunas")}
                  />
                  <Input
                    label="Licencias"
                    type="number"
                    min="0"
                    value={form.licencias}
                    onChange={handleChange("licencias")}
                  />
                  <Input label="Roxair" type="number" min="0" value={form.roxair} onChange={handleChange("roxair")} />
                </div>

                <div className="divider text-xs font-bold uppercase text-base-content/40">Notas</div>

                <div className="grid gap-4">
                  <Input
                    label="Comentarios"
                    as="textarea"
                    rows={3}
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
                      helper="Requerido para auditoría al editar un registro existente"
                    />
                  )}
                </div>

                <div className="flex items-center justify-end gap-3 pt-4">
                  <Button type="submit" disabled={mutation.isPending} size="lg" className="w-full sm:w-auto">
                    {mutation.isPending ? "Guardando..." : selectedId ? "Actualizar Balance" : "Registrar Balance"}
                  </Button>
                </div>
              </form>
            </div>
          )}

          {selectedId && (
            <div className="space-y-6">
              <div className="rounded-3xl border border-base-300/40 bg-base-100/80 p-6 shadow-inner h-fit">
                <div className="flex items-center justify-between gap-2 mb-4">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-base-content/60">Auditoría</p>
                    <h3 className="text-lg font-semibold text-base-content">Historial de cambios</h3>
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
                {historyQuery.isLoading ? (
                  <div className="text-sm text-base-content/60">Cargando historial...</div>
                ) : historyQuery.error ? (
                  <Alert variant="error">No se pudo cargar el historial.</Alert>
                ) : !historyQuery.data?.length ? (
                  <p className="text-sm text-base-content/60">Este es el primer registro.</p>
                ) : (
                  <ul className="space-y-3 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                    {historyQuery.data.map((entry) => (
                      <li
                        key={entry.id}
                        className="rounded-2xl border border-base-300/50 bg-base-200/60 p-3 text-sm text-base-content/80"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                          <div className="flex items-center gap-2">
                            <span className="h-2 w-2 rounded-full bg-primary/50" aria-hidden="true" />
                            <p className="font-semibold text-base-content">{entry.changedByEmail ?? "Sin autor"}</p>
                          </div>
                          <span className="text-xs text-base-content/60">
                            {dayjs(entry.createdAt).format("DD MMM HH:mm")}
                          </span>
                        </div>
                        {entry.changeReason ? (
                          <p className="text-sm text-base-content/70 italic">&quot;{entry.changeReason}&quot;</p>
                        ) : (
                          <p className="text-xs text-base-content/50 italic">Sin motivo registrado</p>
                        )}
                        {entry.snapshot && (
                          <div className="mt-2 pt-2 border-t border-base-content/5 text-xs">
                            <span className="font-medium">Snapshot:</span>{" "}
                            {currencyFormatter.format(entry.snapshot.total)}
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
