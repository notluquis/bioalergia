import { useMemo, useState, useEffect } from "react";
import type { ChangeEvent, FormEvent } from "react";
import dayjs from "dayjs";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Input from "../../components/Input";
import Button from "../../components/Button";
import Alert from "../../components/Alert";
import { useToast } from "../../context/ToastContext";
import { useSettings } from "../../context/SettingsContext";
import {
  fetchProductionBalanceHistory,
  fetchProductionBalances,
  saveProductionBalance,
} from "../../features/dailyProductionBalances/api";
import type { ProductionBalancePayload, ProductionBalanceStatus } from "../../features/dailyProductionBalances/types";
import { deriveTotals, formatActivityTotal } from "../../features/dailyProductionBalances/utils";

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

const makeDefaultForm = (): FormState => ({
  date: dayjs().format("YYYY-MM-DD"),
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

function formatStatus(status: ProductionBalanceStatus) {
  return status === "FINAL" ? "Final" : "Borrador";
}

function StatusBadge({ status }: { status: ProductionBalanceStatus }) {
  const palette =
    status === "FINAL"
      ? "bg-success/15 text-success border-success/40"
      : "bg-warning/10 text-warning border-warning/40";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-[11px] font-semibold ${palette}`}
    >
      <span className="h-2 w-2 rounded-full bg-current" aria-hidden="true" />
      {formatStatus(status)}
    </span>
  );
}

export default function DailyProductionBalancesPage() {
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

  const [from, setFrom] = useState(dayjs().subtract(14, "day").format("YYYY-MM-DD"));
  const [to, setTo] = useState(dayjs().format("YYYY-MM-DD"));
  const [form, setForm] = useState<FormState>(makeDefaultForm);
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
  const selected = useMemo(() => balances.find((item) => item.id === selectedId) ?? null, [balances, selectedId]);

  useEffect(() => {
    if (!selected) return;
    setForm({
      date: selected.date,
      status: selected.status,
      ingresoTarjetas: String(selected.ingresoTarjetas),
      ingresoTransferencias: String(selected.ingresoTransferencias),
      ingresoEfectivo: String(selected.ingresoEfectivo),
      gastosDiarios: String(selected.gastosDiarios),
      otrosAbonos: String(selected.otrosAbonos),
      consultas: String(selected.consultas),
      controles: String(selected.controles),
      tests: String(selected.tests),
      vacunas: String(selected.vacunas),
      licencias: String(selected.licencias),
      roxair: String(selected.roxair),
      comentarios: selected.comentarios ?? "",
      reason: "",
    });
  }, [selected]);

  const derived = deriveTotals({
    ingresoTarjetas: parseNumber(form.ingresoTarjetas),
    ingresoTransferencias: parseNumber(form.ingresoTransferencias),
    ingresoEfectivo: parseNumber(form.ingresoEfectivo),
    gastosDiarios: parseNumber(form.gastosDiarios),
    otrosAbonos: parseNumber(form.otrosAbonos),
  });

  const activitiesTotal =
    parseNumber(form.consultas) +
    parseNumber(form.controles) +
    parseNumber(form.tests) +
    parseNumber(form.vacunas) +
    parseNumber(form.licencias) +
    parseNumber(form.roxair);

  const handleChange =
    (key: keyof FormState) => (event: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
      setForm((prev) => ({ ...prev, [key]: event.target.value }));
    };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    mutation.mutate();
  };

  const handleReset = () => {
    setSelectedId(null);
    setForm(makeDefaultForm());
  };

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-primary">Configuración · Finanzas</p>
        <h1 className="text-3xl font-semibold text-base-content drop-shadow-sm">Balance diario de prestaciones</h1>
        <p className="max-w-3xl text-sm text-base-content/70">
          Registra los ingresos diarios por forma de pago y el detalle de prestaciones (consultas, controles, test,
          vacunas, licencias, Roxair). Todos los montos se guardan en {settings.primaryCurrency || "CLP"} y cada edición
          genera historial para auditoría.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-base-300/40 bg-base-100/70 p-4">
        <Input
          label="Desde"
          type="date"
          value={from}
          onChange={(event) => setFrom(event.target.value)}
          className="max-w-[200px]"
        />
        <Input
          label="Hasta"
          type="date"
          value={to}
          onChange={(event) => setTo(event.target.value)}
          className="max-w-[200px]"
        />
        <Button onClick={() => balancesQuery.refetch()} disabled={balancesQuery.isFetching} size="sm">
          {balancesQuery.isFetching ? "Actualizando..." : "Actualizar rango"}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            const today = dayjs();
            setTo(today.format("YYYY-MM-DD"));
            setFrom(today.subtract(14, "day").format("YYYY-MM-DD"));
          }}
        >
          Últimos 15 días
        </Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-3xl border border-base-300/50 bg-base-200/60 p-4 shadow-inner">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-xs uppercase tracking-wide text-base-content/60">Registros</p>
              <h2 className="text-xl font-semibold text-base-content">Historial reciente</h2>
            </div>
            <span className="text-xs text-base-content/60">{balances.length} registros</span>
          </div>

          {balancesQuery.isLoading ? (
            <div className="mt-4 text-sm text-base-content/60">Cargando balances...</div>
          ) : balancesQuery.error ? (
            <Alert variant="error">No se pudieron cargar los balances.</Alert>
          ) : !balances.length ? (
            <div className="mt-4 rounded-2xl border border-dashed border-base-300/80 p-6 text-sm text-base-content/60">
              Aún no hay balances registrados en el rango seleccionado.
            </div>
          ) : (
            <div className="mt-4 overflow-hidden rounded-2xl border border-base-300/70">
              <table className="min-w-full text-sm">
                <thead className="bg-base-300/40 text-xs uppercase tracking-wide text-base-content/70">
                  <tr>
                    <th className="px-3 py-2 text-left">Fecha</th>
                    <th className="px-3 py-2 text-left">Total ingresos</th>
                    <th className="px-3 py-2 text-left">Gastos</th>
                    <th className="px-3 py-2 text-left">Total día</th>
                    <th className="px-3 py-2 text-left">Atenciones</th>
                    <th className="px-3 py-2 text-left">Estado</th>
                    <th className="px-3 py-2 text-left">Actualizado</th>
                  </tr>
                </thead>
                <tbody>
                  {balances.map((row) => {
                    const isActive = row.id === selectedId;
                    return (
                      <tr
                        key={row.id}
                        className={`cursor-pointer transition-colors ${isActive ? "bg-primary/10" : "hover:bg-base-100/80"}`}
                        onClick={() => setSelectedId(row.id)}
                      >
                        <td className="px-3 py-2 font-semibold text-base-content">
                          {dayjs(row.date).format("DD MMM")}
                        </td>
                        <td className="px-3 py-2 text-base-content/80">
                          {currencyFormatter.format(row.subtotalIngresos)}
                        </td>
                        <td className="px-3 py-2 text-base-content/70">
                          {currencyFormatter.format(row.gastosDiarios)}
                        </td>
                        <td className="px-3 py-2 font-semibold text-base-content">
                          {currencyFormatter.format(row.total)}
                        </td>
                        <td className="px-3 py-2 text-base-content/70">{formatActivityTotal(row)}</td>
                        <td className="px-3 py-2">
                          <StatusBadge status={row.status} />
                        </td>
                        <td className="px-3 py-2 text-xs text-base-content/60">
                          {row.updatedByEmail ?? row.createdByEmail ?? "—"}
                          <div>{dayjs(row.updatedAt).format("DD MMM HH:mm")}</div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="rounded-3xl border border-primary/20 bg-base-100/80 p-5 shadow-lg">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-xs uppercase tracking-wide text-base-content/60">
                {selectedId ? "Editar balance" : "Nuevo balance"}
              </p>
              <h2 className="text-xl font-semibold text-base-content">
                {selectedId ? `Registro #${selectedId}` : "Registrar día"}
              </h2>
            </div>
            <Button variant="ghost" size="sm" onClick={handleReset}>
              Nuevo
            </Button>
          </div>

          <form className="mt-4 space-y-4" onSubmit={handleSubmit}>
            <div className="grid gap-3 sm:grid-cols-2">
              <Input label="Fecha" type="date" value={form.date} onChange={handleChange("date")} required />
              <Input label="Estado" type="select" value={form.status} onChange={handleChange("status")}>
                <option value="FINAL">Final</option>
                <option value="DRAFT">Borrador</option>
              </Input>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
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

            <div className="grid gap-3 sm:grid-cols-3">
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
              <div className="rounded-2xl border border-base-300/60 bg-base-200/60 p-3 text-sm">
                <p className="text-xs uppercase tracking-wide text-base-content/60">Totales (previo a guardar)</p>
                <p className="font-semibold text-base-content">
                  Subtotal: {currencyFormatter.format(derived.subtotal)}
                </p>
                <p className="text-base-content/80">
                  Ingresos - gastos: {currencyFormatter.format(derived.totalIngresos)}
                </p>
                <p className="text-base-content/80">Total día: {currencyFormatter.format(derived.total)}</p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
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
              <Input label="Vacunas" type="number" min="0" value={form.vacunas} onChange={handleChange("vacunas")} />
              <Input
                label="Licencias"
                type="number"
                min="0"
                value={form.licencias}
                onChange={handleChange("licencias")}
              />
              <Input label="Roxair" type="number" min="0" value={form.roxair} onChange={handleChange("roxair")} />
            </div>

            <div className="grid gap-3 sm:grid-cols-[1fr_1fr]">
              <Input
                label="Comentarios"
                type="textarea"
                rows={3}
                value={form.comentarios}
                onChange={handleChange("comentarios")}
                helper="Notas internas sobre el día"
              />
              <Input
                label="Motivo del cambio"
                type="textarea"
                rows={3}
                value={form.reason}
                onChange={handleChange("reason")}
                helper="Opcional, se guarda en el historial"
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="rounded-2xl border border-base-300/50 bg-base-200/60 px-4 py-3 text-sm text-base-content/70">
                <p className="font-semibold text-base-content">Resumen rápido</p>
                <p>Atenciones: {activitiesTotal}</p>
                <p>Total día: {currencyFormatter.format(derived.total)}</p>
              </div>
              <div className="flex gap-2">
                <Button type="button" variant="ghost" onClick={handleReset}>
                  Limpiar
                </Button>
                <Button type="submit" disabled={mutation.isLoading}>
                  {mutation.isLoading ? "Guardando..." : selectedId ? "Actualizar" : "Guardar"}
                </Button>
              </div>
            </div>
          </form>
        </div>
      </div>

      {selectedId && (
        <div className="rounded-3xl border border-base-300/40 bg-base-100/80 p-5 shadow-inner">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-xs uppercase tracking-wide text-base-content/60">Historial</p>
              <h3 className="text-lg font-semibold text-base-content">Cambios del registro #{selectedId}</h3>
            </div>
            <Button variant="ghost" size="sm" onClick={() => historyQuery.refetch()} disabled={historyQuery.isFetching}>
              {historyQuery.isFetching ? "Actualizando..." : "Refrescar"}
            </Button>
          </div>
          {historyQuery.isLoading ? (
            <div className="mt-3 text-sm text-base-content/60">Cargando historial...</div>
          ) : historyQuery.error ? (
            <Alert variant="error">No se pudo cargar el historial.</Alert>
          ) : !historyQuery.data?.length ? (
            <p className="mt-3 text-sm text-base-content/60">Aún no hay cambios registrados.</p>
          ) : (
            <ul className="mt-3 space-y-3">
              {historyQuery.data.map((entry) => (
                <li
                  key={entry.id}
                  className="rounded-2xl border border-base-300/50 bg-base-200/60 p-3 text-sm text-base-content/80"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full bg-primary" aria-hidden="true" />
                      <p className="font-semibold text-base-content">{entry.changedByEmail ?? "Sin autor"}</p>
                    </div>
                    <span className="text-xs text-base-content/60">
                      {dayjs(entry.createdAt).format("DD MMM HH:mm")}
                    </span>
                  </div>
                  {entry.changeReason && (
                    <p className="mt-1 text-sm text-base-content/70">Motivo: {entry.changeReason}</p>
                  )}
                  {entry.snapshot && (
                    <p className="mt-1 text-sm text-base-content/70">
                      Total del snapshot: {currencyFormatter.format(entry.snapshot.total)} · Atenciones:{" "}
                      {formatActivityTotal(entry.snapshot)}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
