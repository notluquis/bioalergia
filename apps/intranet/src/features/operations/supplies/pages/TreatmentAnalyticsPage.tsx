import { Chip, Spinner } from "@heroui/react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import dayjs from "dayjs";
import "dayjs/locale/es";
import {
  Calendar,
  ChevronDown,
  ChevronUp,
  DollarSign,
  Home,
  Package,
  RefreshCcw,
  Syringe,
} from "lucide-react";
import { useState } from "react";

dayjs.locale("es");

import Button from "@/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { calendarQueries } from "@/features/calendar/queries";
import type { TreatmentAnalyticsFilters } from "@/features/calendar/types";
import { formatCurrency } from "@/lib/utils";
import { Route } from "@/routes/_authed/operations/supplies-analytics";

// Helper functions for quick date ranges
const getToday = () => {
  return { from: dayjs().format("YYYY-MM-DD"), to: dayjs().format("YYYY-MM-DD") };
};

const getYesterday = () => {
  const yesterday = dayjs().subtract(1, "day");
  return { from: yesterday.format("YYYY-MM-DD"), to: yesterday.format("YYYY-MM-DD") };
};

const getTomorrow = () => {
  const tomorrow = dayjs().add(1, "day");
  return { from: tomorrow.format("YYYY-MM-DD"), to: tomorrow.format("YYYY-MM-DD") };
};

const getThisWeek = () => {
  return {
    from: dayjs().startOf("week").format("YYYY-MM-DD"),
    to: dayjs().endOf("week").format("YYYY-MM-DD"),
  };
};

const getLastWeek = () => {
  return {
    from: dayjs().subtract(1, "week").startOf("week").format("YYYY-MM-DD"),
    to: dayjs().subtract(1, "week").endOf("week").format("YYYY-MM-DD"),
  };
};

const getNextWeek = () => {
  return {
    from: dayjs().add(1, "week").startOf("week").format("YYYY-MM-DD"),
    to: dayjs().add(1, "week").endOf("week").format("YYYY-MM-DD"),
  };
};

const getThisMonth = () => {
  return {
    from: dayjs().startOf("month").format("YYYY-MM-DD"),
    to: dayjs().endOf("month").format("YYYY-MM-DD"),
  };
};

const getLastMonth = () => {
  return {
    from: dayjs().subtract(1, "month").startOf("month").format("YYYY-MM-DD"),
    to: dayjs().subtract(1, "month").endOf("month").format("YYYY-MM-DD"),
  };
};

const getNextMonth = () => {
  return {
    from: dayjs().add(1, "month").startOf("month").format("YYYY-MM-DD"),
    to: dayjs().add(1, "month").endOf("month").format("YYYY-MM-DD"),
  };
};

export default function TreatmentAnalyticsPage() {
  const navigate = useNavigate({ from: Route.fullPath });
  const searchParams = Route.useSearch();
  const [period, setPeriod] = useState<"day" | "week" | "month">(searchParams.period || "week");
  const [showRangePicker, setShowRangePicker] = useState(true);

  const filters: TreatmentAnalyticsFilters = {
    from: searchParams.from,
    to: searchParams.to,
  };

  const hasValidDates = !!filters.from && !!filters.to;

  const { data, isLoading, isError, error, refetch } = useQuery({
    ...calendarQueries.treatmentAnalytics(filters),
    enabled: hasValidDates,
  });

  const handleDateChange = (from: string, to: string) => {
    void navigate({
      search: { ...searchParams, from, to },
    });
  };

  const handleQuickRange = (range: { from: string; to: string }) => {
    void navigate({
      search: { ...searchParams, from: range.from, to: range.to },
    });
    // Colapsar el selector después de elegir un rango
    if (hasValidDates) {
      setShowRangePicker(false);
    }
  };

  const handleRefresh = () => {
    void refetch();
  };

  // Calculate metrics
  const totalRevenue = data?.totals.amountPaid || 0;
  const totalExpected = data?.totals.amountExpected || 0;
  const revenuePercentage = totalExpected > 0 ? (totalRevenue / totalExpected) * 100 : 0;
  const domicilioPercentage =
    data && data.totals.events > 0 ? (data.totals.domicilioCount / data.totals.events) * 100 : 0;
  const induccionPercentage =
    data && data.totals.events > 0 ? (data.totals.induccionCount / data.totals.events) * 100 : 0;
  const mantencionPercentage =
    data && data.totals.events > 0 ? (data.totals.mantencionCount / data.totals.events) * 100 : 0;
  const unclassifiedStageCount =
    (data?.totals.events || 0) -
    (data?.totals.induccionCount || 0) -
    (data?.totals.mantencionCount || 0);
  const unclassifiedStagePercentage =
    data && data.totals.events > 0 ? (unclassifiedStageCount / data.totals.events) * 100 : 0;

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center min-h-100 gap-4">
        <p className="text-danger">Error cargando analytics: {(error as Error).message}</p>
        <Button onClick={handleRefresh}>Reintentar</Button>
      </div>
    );
  }

  return (
    <section className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Analytics de Tratamientos</h1>
          <p className="text-sm text-default-500 mt-1">
            Métricas y análisis de tratamientos subcutáneos
          </p>
        </div>
        <Button
          size="sm"
          variant="secondary"
          onClick={handleRefresh}
          disabled={isLoading}
          className="flex items-center gap-2"
        >
          <RefreshCcw className="h-4 w-4" />
          Actualizar
        </Button>
      </div>

      {/* Date Range Controls */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex-1">
              {hasValidDates ? (
                <div className="flex items-center gap-3">
                  <Chip size="sm" variant="soft" color="success">
                    {dayjs(filters.from).format("DD MMM YYYY")} -{" "}
                    {dayjs(filters.to).format("DD MMM YYYY")}
                  </Chip>
                  <button
                    type="button"
                    onClick={() => setShowRangePicker(!showRangePicker)}
                    className="text-sm text-primary hover:underline flex items-center gap-1"
                  >
                    {showRangePicker ? (
                      <>
                        <ChevronUp className="h-4 w-4" />
                        Ocultar selector
                      </>
                    ) : (
                      <>
                        <ChevronDown className="h-4 w-4" />
                        Cambiar fechas
                      </>
                    )}
                  </button>
                </div>
              ) : (
                <p className="text-sm font-medium text-default-700">
                  Selecciona un rango de fechas
                </p>
              )}
            </div>
          </div>
        </CardHeader>

        {showRangePicker && (
          <CardContent className="space-y-4 p-6 border-t border-divider">
            {/* Custom Date Inputs */}
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-end">
              <div className="flex flex-col gap-1.5 flex-1">
                <label className="text-xs font-medium text-default-600" htmlFor="from-date">
                  Desde
                </label>
                <input
                  className="px-3 py-2.5 rounded-lg bg-content1 border-2 border-divider focus:border-primary focus:outline-none text-sm transition-colors text-foreground"
                  id="from-date"
                  max={filters.to}
                  placeholder="Fecha inicial"
                  type="date"
                  value={filters.from || ""}
                  onChange={(e) => handleDateChange(e.target.value, filters.to || e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1.5 flex-1">
                <label className="text-xs font-medium text-default-600" htmlFor="to-date">
                  Hasta
                </label>
                <input
                  className="px-3 py-2.5 rounded-lg bg-content1 border-2 border-divider focus:border-primary focus:outline-none text-sm transition-colors text-foreground"
                  id="to-date"
                  min={filters.from}
                  placeholder="Fecha final"
                  type="date"
                  value={filters.to || ""}
                  onChange={(e) => handleDateChange(filters.from || e.target.value, e.target.value)}
                />
              </div>
            </div>

            {/* Quick Range Selectors */}
            <div className="space-y-4 pt-2">
              <div className="border-t border-dashed border-default-200 pt-4">
                <p className="text-xs font-semibold text-default-700 mb-3">Rangos rápidos</p>

                {/* Single Day */}
                <div className="space-y-2.5">
                  <p className="text-xs text-default-500 font-medium">Día específico</p>
                  <div className="flex flex-wrap gap-2">
                    <Chip
                      size="sm"
                      variant="soft"
                      color="default"
                      className="cursor-pointer hover:scale-105 transition-transform"
                      onClick={() => handleQuickRange(getYesterday())}
                    >
                      Ayer
                    </Chip>
                    <Chip
                      size="sm"
                      variant="soft"
                      color="success"
                      className="cursor-pointer hover:scale-105 transition-transform"
                      onClick={() => handleQuickRange(getToday())}
                    >
                      Hoy
                    </Chip>
                    <Chip
                      size="sm"
                      variant="soft"
                      color="default"
                      className="cursor-pointer hover:scale-105 transition-transform"
                      onClick={() => handleQuickRange(getTomorrow())}
                    >
                      Mañana
                    </Chip>
                  </div>
                </div>

                {/* Weeks */}
                <div className="space-y-2.5 mt-4">
                  <p className="text-xs text-default-500 font-medium">Semana</p>
                  <div className="flex flex-wrap gap-2">
                    <Chip
                      size="sm"
                      variant="soft"
                      color="accent"
                      className="cursor-pointer hover:scale-105 transition-transform"
                      onClick={() => handleQuickRange(getLastWeek())}
                    >
                      Semana pasada
                    </Chip>
                    <Chip
                      size="sm"
                      variant="soft"
                      color="success"
                      className="cursor-pointer hover:scale-105 transition-transform"
                      onClick={() => handleQuickRange(getThisWeek())}
                    >
                      Esta semana
                    </Chip>
                    <Chip
                      size="sm"
                      variant="soft"
                      color="accent"
                      className="cursor-pointer hover:scale-105 transition-transform"
                      onClick={() => handleQuickRange(getNextWeek())}
                    >
                      Próxima semana
                    </Chip>
                  </div>
                </div>

                {/* Months */}
                <div className="space-y-2.5 mt-4">
                  <p className="text-xs text-default-500 font-medium">Mes</p>
                  <div className="flex flex-wrap gap-2">
                    <Chip
                      size="sm"
                      variant="soft"
                      color="warning"
                      className="cursor-pointer hover:scale-105 transition-transform"
                      onClick={() => handleQuickRange(getLastMonth())}
                    >
                      Mes pasado
                    </Chip>
                    <Chip
                      size="sm"
                      variant="soft"
                      color="success"
                      className="cursor-pointer hover:scale-105 transition-transform"
                      onClick={() => handleQuickRange(getThisMonth())}
                    >
                      Este mes
                    </Chip>
                    <Chip
                      size="sm"
                      variant="soft"
                      color="warning"
                      className="cursor-pointer hover:scale-105 transition-transform"
                      onClick={() => handleQuickRange(getNextMonth())}
                    >
                      Próximo mes
                    </Chip>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      {!hasValidDates ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 gap-4">
            <Calendar className="h-16 w-16 text-default-300" />
            <div className="text-center">
              <p className="text-lg font-semibold text-default-600">
                Selecciona un rango de fechas
              </p>
              <p className="text-sm text-default-400 mt-1">
                Elige las fechas o usa los rangos rápidos para ver las métricas
              </p>
            </div>
          </CardContent>
        </Card>
      ) : isLoading ? (
        <div className="flex justify-center items-center min-h-100">
          <Spinner size="lg" />
          <span className="ml-4">Cargando analytics...</span>
        </div>
      ) : (
        <>
          {/* KPI Metrics Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            <Card>
              <CardContent className="flex flex-row items-center gap-4 p-6">
                <div className="p-3 rounded-lg bg-primary/10">
                  <Syringe className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-default-500">Total Tratamientos</p>
                  <p className="text-2xl font-bold">{data?.totals.events || 0}</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="flex flex-row items-center gap-4 p-6">
                <div className="p-3 rounded-lg bg-success/10">
                  <DollarSign className="h-6 w-6 text-success" />
                </div>
                <div>
                  <p className="text-sm text-default-500">$ Cobrado</p>
                  <p className="text-2xl font-bold">{formatCurrency(totalRevenue)}</p>
                  <p className="text-xs text-default-400">
                    {revenuePercentage.toFixed(1)}% de esperado
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="flex flex-row items-center gap-4 p-6">
                <div className="p-3 rounded-lg bg-warning/10">
                  <Package className="h-6 w-6 text-warning" />
                </div>
                <div>
                  <p className="text-sm text-default-500">ml Consumidos</p>
                  <p className="text-2xl font-bold">{data?.totals.dosageMl.toFixed(1) || 0}</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="flex flex-row items-center gap-4 p-6">
                <div className="p-3 rounded-lg bg-secondary/10">
                  <Home className="h-6 w-6 text-secondary" />
                </div>
                <div>
                  <p className="text-sm text-default-500">Domicilio</p>
                  <p className="text-2xl font-bold">{data?.totals.domicilioCount || 0}</p>
                  <p className="text-xs text-default-400">{domicilioPercentage.toFixed(1)}%</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Treatment Stage Breakdown */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <p className="text-sm font-semibold">Etapa de Tratamiento</p>
              </CardHeader>
              <CardContent className="gap-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm">Inducción</span>
                  <span className="text-sm font-semibold">
                    {data?.totals.induccionCount || 0} ({induccionPercentage.toFixed(1)}%)
                  </span>
                </div>
                <div className="w-full bg-default-200 rounded-full h-2">
                  <div
                    className="bg-primary h-2 rounded-full transition-all"
                    style={{ width: `${induccionPercentage}%` }}
                  />
                </div>
                <div className="flex justify-between items-center mt-3">
                  <span className="text-sm">Mantención</span>
                  <span className="text-sm font-semibold">
                    {data?.totals.mantencionCount || 0} ({mantencionPercentage.toFixed(1)}%)
                  </span>
                </div>
                <div className="w-full bg-default-200 rounded-full h-2">
                  <div
                    className="bg-secondary h-2 rounded-full transition-all"
                    style={{ width: `${mantencionPercentage}%` }}
                  />
                </div>
                <div className="flex justify-between items-center mt-3">
                  <span className="text-sm">Sin clasificar</span>
                  <span className="text-sm font-semibold">
                    {unclassifiedStageCount} ({unclassifiedStagePercentage.toFixed(1)}%)
                  </span>
                </div>
                <div className="w-full bg-default-200 rounded-full h-2">
                  <div
                    className="bg-default-400 h-2 rounded-full transition-all"
                    style={{ width: `${unclassifiedStagePercentage}%` }}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <p className="text-sm font-semibold">Ubicación de Entrega</p>
              </CardHeader>
              <CardContent className="gap-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm">Domicilio</span>
                  <span className="text-sm font-semibold">
                    {data?.totals.domicilioCount || 0} ({domicilioPercentage.toFixed(1)}%)
                  </span>
                </div>
                <div className="w-full bg-default-200 rounded-full h-2">
                  <div
                    className="bg-secondary h-2 rounded-full transition-all"
                    style={{ width: `${domicilioPercentage}%` }}
                  />
                </div>
                <div className="flex justify-between items-center mt-3">
                  <span className="text-sm">Clínica</span>
                  <span className="text-sm font-semibold">
                    {(data?.totals.events || 0) - (data?.totals.domicilioCount || 0)} (
                    {(100 - domicilioPercentage).toFixed(1)}%)
                  </span>
                </div>
                <div className="w-full bg-default-200 rounded-full h-2">
                  <div
                    className="bg-primary h-2 rounded-full transition-all"
                    style={{ width: `${100 - domicilioPercentage}%` }}
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Period Selector */}
          <Card>
            <CardHeader>
              <div className="flex gap-2 border-b border-divider pb-2">
                <button
                  type="button"
                  className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
                    period === "day"
                      ? "bg-primary text-primary-foreground"
                      : "bg-default-100 hover:bg-default-200"
                  }`}
                  onClick={() => setPeriod("day")}
                >
                  Por Día
                </button>
                <button
                  type="button"
                  className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
                    period === "week"
                      ? "bg-primary text-primary-foreground"
                      : "bg-default-100 hover:bg-default-200"
                  }`}
                  onClick={() => setPeriod("week")}
                >
                  Por Semana
                </button>
                <button
                  type="button"
                  className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
                    period === "month"
                      ? "bg-primary text-primary-foreground"
                      : "bg-default-100 hover:bg-default-200"
                  }`}
                  onClick={() => setPeriod("month")}
                >
                  Por Mes
                </button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-divider">
                      <th className="text-left py-3 px-2 font-semibold">
                        {period === "day" && "Fecha"}
                        {period === "week" && "Semana"}
                        {period === "month" && "Mes"}
                      </th>
                      <th className="text-right py-3 px-2 font-semibold">Tratamientos</th>
                      <th className="text-right py-3 px-2 font-semibold">$ Cobrado</th>
                      <th className="text-right py-3 px-2 font-semibold">ml</th>
                      <th className="text-right py-3 px-2 font-semibold">Domicilio</th>
                      <th className="text-right py-3 px-2 font-semibold">Inducción</th>
                      <th className="text-right py-3 px-2 font-semibold">Mantención</th>
                      <th className="text-right py-3 px-2 font-semibold">Sin clasificar</th>
                    </tr>
                  </thead>
                  <tbody>
                    {period === "day" &&
                      data?.byDate.map((row) => (
                        <tr key={row.date} className="border-b border-divider hover:bg-default-50">
                          <td className="py-3 px-2">{dayjs(row.date).format("DD MMM YYYY")}</td>
                          <td className="text-right py-3 px-2">{row.events}</td>
                          <td className="text-right py-3 px-2">{formatCurrency(row.amountPaid)}</td>
                          <td className="text-right py-3 px-2">{row.dosageMl.toFixed(1)}</td>
                          <td className="text-right py-3 px-2">{row.domicilioCount}</td>
                          <td className="text-right py-3 px-2">{row.induccionCount}</td>
                          <td className="text-right py-3 px-2">{row.mantencionCount}</td>
                          <td className="text-right py-3 px-2">
                            {row.events - row.induccionCount - row.mantencionCount}
                          </td>
                        </tr>
                      ))}
                    {period === "week" &&
                      data?.byWeek.map((row) => (
                        <tr
                          key={`${row.isoYear}-${row.isoWeek}`}
                          className="border-b border-divider hover:bg-default-50"
                        >
                          <td className="py-3 px-2">
                            Semana {row.isoWeek}, {row.isoYear}
                          </td>
                          <td className="text-right py-3 px-2">{row.events}</td>
                          <td className="text-right py-3 px-2">{formatCurrency(row.amountPaid)}</td>
                          <td className="text-right py-3 px-2">{row.dosageMl.toFixed(1)}</td>
                          <td className="text-right py-3 px-2">{row.domicilioCount}</td>
                          <td className="text-right py-3 px-2">{row.induccionCount}</td>
                          <td className="text-right py-3 px-2">{row.mantencionCount}</td>
                          <td className="text-right py-3 px-2">
                            {row.events - row.induccionCount - row.mantencionCount}
                          </td>
                        </tr>
                      ))}
                    {period === "month" &&
                      data?.byMonth.map((row) => (
                        <tr
                          key={`${row.year}-${row.month}`}
                          className="border-b border-divider hover:bg-default-50"
                        >
                          <td className="py-3 px-2">
                            {dayjs(`${row.year}-${row.month}-01`).format("MMMM YYYY")}
                          </td>
                          <td className="text-right py-3 px-2">{row.events}</td>
                          <td className="text-right py-3 px-2">{formatCurrency(row.amountPaid)}</td>
                          <td className="text-right py-3 px-2">{row.dosageMl.toFixed(1)}</td>
                          <td className="text-right py-3 px-2">{row.domicilioCount}</td>
                          <td className="text-right py-3 px-2">{row.induccionCount}</td>
                          <td className="text-right py-3 px-2">{row.mantencionCount}</td>
                          <td className="text-right py-3 px-2">
                            {row.events - row.induccionCount - row.mantencionCount}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
              {((period === "day" && data?.byDate.length === 0) ||
                (period === "week" && data?.byWeek.length === 0) ||
                (period === "month" && data?.byMonth.length === 0)) && (
                <div className="text-center py-8 text-default-500">
                  <Calendar className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>No hay datos para el período seleccionado</p>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </section>
  );
}
