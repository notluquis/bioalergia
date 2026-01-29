import { Spinner } from "@heroui/react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import dayjs from "dayjs";
import { Calendar, DollarSign, Home, Package, RefreshCcw, Syringe } from "lucide-react";
import { useState } from "react";

import Button from "@/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { calendarQueries } from "@/features/calendar/queries";
import type { TreatmentAnalyticsFilters } from "@/features/calendar/types";
import { formatCurrency } from "@/lib/utils";
import { Route } from "@/routes/_authed/operations/supplies-analytics";

export default function TreatmentAnalyticsPage() {
  const navigate = useNavigate({ from: Route.fullPath });
  const searchParams = Route.useSearch();
  const [period, setPeriod] = useState<"day" | "week" | "month">(searchParams.period || "week");

  // Default to last 30 days if no dates provided
  const defaultFrom = dayjs().subtract(30, "day").format("YYYY-MM-DD");
  const defaultTo = dayjs().format("YYYY-MM-DD");

  const filters: TreatmentAnalyticsFilters = {
    from: searchParams.from || defaultFrom,
    to: searchParams.to || defaultTo,
  };

  const { data, isLoading, isError, error, refetch } = useQuery(
    calendarQueries.treatmentAnalytics(filters),
  );

  const handleDateChange = (from: string, to: string) => {
    void navigate({
      search: { ...searchParams, from, to },
    });
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
        <CardContent className="flex flex-col sm:flex-row gap-4 items-start sm:items-center p-6">
          <div className="flex flex-col sm:flex-row gap-4 flex-1">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-default-500" htmlFor="from-date">
                Desde
              </label>
              <input
                className="px-3 py-2 rounded-lg bg-default-100 text-sm border border-default-200"
                id="from-date"
                max={filters.to}
                type="date"
                value={filters.from}
                onChange={(e) => handleDateChange(e.target.value, filters.to || defaultTo)}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-default-500" htmlFor="to-date">
                Hasta
              </label>
              <input
                className="px-3 py-2 rounded-lg bg-default-100 text-sm border border-default-200"
                id="to-date"
                min={filters.from}
                type="date"
                value={filters.to}
                onChange={(e) => handleDateChange(filters.from || defaultFrom, e.target.value)}
              />
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                const from = dayjs().subtract(7, "day").format("YYYY-MM-DD");
                const to = dayjs().format("YYYY-MM-DD");
                handleDateChange(from, to);
              }}
            >
              Última semana
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                const from = dayjs().subtract(30, "day").format("YYYY-MM-DD");
                const to = dayjs().format("YYYY-MM-DD");
                handleDateChange(from, to);
              }}
            >
              Último mes
            </Button>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
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
