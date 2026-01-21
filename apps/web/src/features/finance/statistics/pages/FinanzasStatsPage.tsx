/**
 * Financial Statistics Page
 * Dashboard de estadísticas financieras con KPIs, gráficas y análisis temporal
 */

import { Spinner } from "@heroui/react";
import dayjs from "dayjs";
import { ArrowDown, ArrowUp, BarChart3, Calendar, TrendingUp } from "lucide-react";
import { useState } from "react";

import Alert from "@/components/ui/Alert";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import StatCard from "@/components/ui/StatCard";
import { useAuth } from "@/context/AuthContext";
import { BalanceSummary } from "@/features/finance/balances/components/BalanceSummary";
import { PAGE_CONTAINER } from "@/lib/styles";

import MonthlyFlowChart from "../components/MonthlyFlowChart";
import MovementTypeList from "../components/MovementTypeList";
import TopParticipantsSection from "../components/TopParticipantsSection";
import { useStatsData } from "../hooks/use-stats-data";

import "dayjs/locale/es";

const DATE_FORMAT = "YYYY-MM-DD";

dayjs.locale("es");

// Quick date ranges
const QUICK_MONTHS = [
  {
    from: dayjs().startOf("month").format(DATE_FORMAT),
    label: "Este mes",
    to: dayjs().endOf("month").format(DATE_FORMAT),
    value: "current",
  },
  {
    from: dayjs().subtract(1, "month").startOf("month").format(DATE_FORMAT),
    label: "Mes pasado",
    to: dayjs().subtract(1, "month").endOf("month").format(DATE_FORMAT),
    value: "previous",
  },
  {
    from: dayjs().subtract(3, "month").startOf("month").format(DATE_FORMAT),
    label: "Últimos 3 meses",
    to: dayjs().endOf("month").format(DATE_FORMAT),
    value: "3months",
  },
  {
    from: dayjs().subtract(6, "month").startOf("month").format(DATE_FORMAT),
    label: "Últimos 6 meses",
    to: dayjs().endOf("month").format(DATE_FORMAT),
    value: "6months",
  },
  {
    from: dayjs().startOf("year").format(DATE_FORMAT),
    label: "Este año",
    to: dayjs().endOf("year").format(DATE_FORMAT),
    value: "year",
  },
];

export default function FinanzasStatsPage() {
  const { can } = useAuth();
  const {
    balancesError,
    balancesLoading,
    balancesReport,
    data,
    error,
    from,
    loading,
    participantsError,
    participantsLoading,
    refetch,
    setFrom,
    setTo,
    to,
    topParticipants,
  } = useStatsData();

  const [quickRange, setQuickRange] = useState("3months");

  const canView = can("read", "Transaction");

  const handleQuickRangeChange = (value: string) => {
    setQuickRange(value);
    if (value === "custom") return;

    const match = QUICK_MONTHS.find((month) => month.value === value);
    if (match) {
      setFrom(match.from);
      setTo(match.to);
    }
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    void refetch();
  };

  // Calculate totals
  const totals = data
    ? {
        in: data.totals?.IN ?? 0,
        net: (data.totals?.IN ?? 0) - (data.totals?.OUT ?? 0),
        out: data.totals?.OUT ?? 0,
      }
    : { in: 0, net: 0, out: 0 };

  if (!canView) {
    return (
      <section className={PAGE_CONTAINER}>
        <Alert variant="error">No tienes permisos para ver las estadísticas financieras.</Alert>
      </section>
    );
  }

  return (
    <section className={PAGE_CONTAINER}>
      {/* Date Range Filters */}
      <form
        className="bg-base-100 border-base-200 grid gap-4 rounded-2xl border p-6 shadow-sm sm:grid-cols-5"
        onSubmit={handleSubmit}
      >
        <div className="form-control">
          <label className="label text-xs font-medium" htmlFor="from-date">
            Desde
          </label>
          <Input
            className="input-sm"
            id="from-date"
            onChange={(e) => {
              setFrom(e.target.value);
              setQuickRange("custom");
            }}
            type="date"
            value={from}
          />
        </div>

        <div className="form-control">
          <label className="label text-xs font-medium" htmlFor="to-date">
            Hasta
          </label>
          <Input
            className="input-sm"
            id="to-date"
            onChange={(e) => {
              setTo(e.target.value);
              setQuickRange("custom");
            }}
            type="date"
            value={to}
          />
        </div>

        <div className="form-control">
          <label className="label text-xs font-medium" htmlFor="quick-range">
            Intervalo rápido
          </label>
          <select
            className="select select-bordered select-sm"
            id="quick-range"
            onChange={(e) => {
              handleQuickRangeChange(e.target.value);
            }}
            value={quickRange}
          >
            <option value="custom">Personalizado</option>
            {QUICK_MONTHS.map((month) => (
              <option key={month.value} value={month.value}>
                {month.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-end gap-2 sm:col-span-2">
          <Button className="w-full" disabled={loading} size="sm" type="submit" variant="primary">
            {loading ? (
              <>
                <Spinner size="sm" />
                Calculando...
              </>
            ) : (
              <>
                <TrendingUp className="h-4 w-4" />
                Actualizar
              </>
            )}
          </Button>
        </div>
      </form>

      {/* Error Alert */}
      {error && <Alert variant="error">{error}</Alert>}

      {/* Main Content */}
      {data && (
        <div className="space-y-6">
          {/* KPI Cards */}
          <section className="grid gap-4 sm:grid-cols-3">
            <StatCard
              className="text-success"
              icon={ArrowUp}
              subtitle="Total periodo"
              title="INGRESOS"
              value={totals.in}
            />
            <StatCard
              className="text-error"
              icon={ArrowDown}
              subtitle="Total periodo"
              title="EGRESOS"
              value={totals.out}
            />
            <StatCard
              className={totals.net >= 0 ? "text-success" : "text-error"}
              icon={BarChart3}
              subtitle="Ingresos - Egresos"
              title="RESULTADO"
              value={totals.net}
            />
          </section>

          {/* Monthly Flow Chart */}
          <MonthlyFlowChart data={data.monthly} />

          {/* Daily Balances Summary */}
          {balancesReport && (
            <BalanceSummary
              error={balancesError}
              loading={balancesLoading}
              report={balancesReport}
            />
          )}

          {/* Two Column Grid: Movement Types + Top Participants */}
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Movement Types */}
            <div className="bg-base-100 border-base-200 rounded-2xl border p-6 shadow-sm">
              <h2 className="mb-4 flex items-center gap-2 text-lg font-bold">
                <Calendar className="text-secondary h-5 w-5" />
                Por tipo de movimiento
              </h2>
              <MovementTypeList data={data.byType} />
            </div>

            {/* Top Participants Preview */}
            <div className="bg-base-100 border-base-200 rounded-2xl border p-6 shadow-sm">
              <h2 className="mb-4 flex items-center gap-2 text-lg font-bold">
                <TrendingUp className="text-accent h-5 w-5" />
                Resumen rápido
              </h2>
              <div className="space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-base-content/70">Meses analizados:</span>
                  <span className="font-mono font-semibold">{data.monthly.length}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-base-content/70">Tipos de movimiento:</span>
                  <span className="font-mono font-semibold">{data.byType.length}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-base-content/70">Top contrapartes:</span>
                  <span className="font-mono font-semibold">{topParticipants.length}</span>
                </div>
                <div className="divider my-2" />
                <div className="flex items-center justify-between">
                  <span className="text-base-content/70">Promedio mensual:</span>
                  <span className="text-primary font-mono font-semibold">
                    $
                    {data.monthly.length > 0
                      ? Math.round(totals.net / data.monthly.length).toLocaleString("es-CL")
                      : 0}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Top Participants Section */}
          <TopParticipantsSection
            data={topParticipants}
            error={participantsError}
            loading={participantsLoading}
          />
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && data?.monthly.length === 0 && (
        <Alert variant="warning">No se encontraron movimientos en el rango seleccionado.</Alert>
      )}
    </section>
  );
}
