import { Tabs } from "@heroui/react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { BarChart3, TrendingUp } from "lucide-react";
import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Select, SelectItem } from "@/components/ui/Select";
import { dteAnalyticsKeys } from "@/features/finance/dte-analytics/queries";

const MONTH_NAMES = [
  "Ene",
  "Feb",
  "Mar",
  "Abr",
  "May",
  "Jun",
  "Jul",
  "Ago",
  "Sep",
  "Oct",
  "Nov",
  "Dic",
];

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("es-CL", {
    currency: "CLP",
    style: "currency",
  }).format(value);

const formatNumber = (value: number) => new Intl.NumberFormat("es-CL").format(value);

export function DTEAnalyticsPage() {
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear.toString());

  const yearOptions = useMemo(() => {
    const years = [];
    for (let y = 2020; y <= currentYear + 1; y++) {
      years.push(y.toString());
    }
    return years;
  }, [currentYear]);

  return (
    <div className="container mx-auto space-y-6 p-6">
      <Tabs aria-label="DTE Analytics Tabs" defaultSelectedKey="purchases-monthly">
        <Tabs.List
          aria-label="Opciones de visualización"
          className="rounded-lg bg-default-50/50 p-1"
        >
          <Tabs.Tab id="purchases-monthly" className="gap-2">
            <BarChart3 className="size-4" />
            Compras Mensual
          </Tabs.Tab>
          <Tabs.Tab id="sales-monthly" className="gap-2">
            <BarChart3 className="size-4" />
            Ventas Mensual
          </Tabs.Tab>
          <Tabs.Tab id="purchases-comparison" className="gap-2">
            <TrendingUp className="size-4" />
            Compras Comparativa
          </Tabs.Tab>
          <Tabs.Tab id="sales-comparison" className="gap-2">
            <TrendingUp className="size-4" />
            Ventas Comparativa
          </Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel id="purchases-monthly">
          <PurchasesMonthlySummary
            selectedYear={selectedYear}
            setSelectedYear={setSelectedYear}
            yearOptions={yearOptions}
          />
        </Tabs.Panel>

        <Tabs.Panel id="sales-monthly">
          <SalesMonthlySummary
            selectedYear={selectedYear}
            setSelectedYear={setSelectedYear}
            yearOptions={yearOptions}
          />
        </Tabs.Panel>

        <Tabs.Panel id="purchases-comparison">
          <PurchasesComparison />
        </Tabs.Panel>

        <Tabs.Panel id="sales-comparison">
          <SalesComparison />
        </Tabs.Panel>
      </Tabs>
    </div>
  );
}

interface MonthlySummaryProps {
  selectedYear: string;
  setSelectedYear: (year: string) => void;
  yearOptions: string[];
}

function PurchasesMonthlySummary({
  selectedYear,
  setSelectedYear,
  yearOptions,
}: MonthlySummaryProps) {
  const { data: summary } = useSuspenseQuery(dteAnalyticsKeys.purchases(Number(selectedYear)));

  const chartData = useMemo(() => {
    const monthMap = new Map(summary.map((s) => [s.period, s]));
    return Array.from({ length: 12 }, (_, i) => {
      const month = (i + 1).toString().padStart(2, "0");
      const period = `${selectedYear}-${month}`;
      const item = monthMap.get(period);
      return {
        averageAmount: item?.averageAmount ?? 0,
        count: item?.count ?? 0,
        month: MONTH_NAMES[i],
        netAmount: item?.netAmount ?? 0,
        taxAmount: item?.taxAmount ?? 0,
        totalAmount: item?.totalAmount ?? 0,
      };
    });
  }, [summary, selectedYear]);

  const totals = useMemo(
    () => ({
      averageAmount: chartData.reduce((sum, d) => sum + d.averageAmount, 0) / 12,
      count: chartData.reduce((sum, d) => sum + d.count, 0),
      netAmount: chartData.reduce((sum, d) => sum + d.netAmount, 0),
      taxAmount: chartData.reduce((sum, d) => sum + d.taxAmount, 0),
      totalAmount: chartData.reduce((sum, d) => sum + d.totalAmount, 0),
    }),
    [chartData],
  );

  return (
    <div className="space-y-4 pt-4">
      <div className="flex items-center gap-4">
        <Select
          label="Año"
          placeholder="Seleccionar año"
          value={selectedYear}
          onChange={(key) => {
            if (key) {
              setSelectedYear(key.toString());
            }
          }}
        >
          {yearOptions.map((year) => (
            <SelectItem key={year} id={year}>
              {year}
            </SelectItem>
          ))}
        </Select>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Total Compras</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-bold text-2xl">{formatCurrency(totals.totalAmount)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Neto</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-bold text-2xl">{formatCurrency(totals.netAmount)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">IVA Recuperable</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-bold text-2xl">{formatCurrency(totals.taxAmount)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Documentos</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-bold text-2xl">{formatNumber(totals.count)}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Compras Mensuales {selectedYear}</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer height={400} width="100%">
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis
                tickFormatter={(value: number | undefined) =>
                  value !== undefined ? formatCurrency(value) : "N/A"
                }
              />
              <Tooltip
                formatter={(value: number | undefined) =>
                  value !== undefined ? formatCurrency(value) : "N/A"
                }
                labelStyle={{ color: "#000" }}
              />
              <Legend />
              <Bar dataKey="totalAmount" fill="#3b82f6" name="Total" />
              <Bar dataKey="netAmount" fill="#10b981" name="Neto" />
              <Bar dataKey="taxAmount" fill="#f59e0b" name="IVA" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}

function SalesMonthlySummary({ selectedYear, setSelectedYear, yearOptions }: MonthlySummaryProps) {
  const { data: summary } = useSuspenseQuery(dteAnalyticsKeys.sales(Number(selectedYear)));

  const chartData = useMemo(() => {
    const monthMap = new Map(summary.map((s) => [s.period, s]));
    return Array.from({ length: 12 }, (_, i) => {
      const month = (i + 1).toString().padStart(2, "0");
      const period = `${selectedYear}-${month}`;
      const item = monthMap.get(period);
      return {
        averageAmount: item?.averageAmount ?? 0,
        count: item?.count ?? 0,
        month: MONTH_NAMES[i],
        netAmount: item?.netAmount ?? 0,
        taxAmount: item?.taxAmount ?? 0,
        totalAmount: item?.totalAmount ?? 0,
      };
    });
  }, [summary, selectedYear]);

  const totals = useMemo(
    () => ({
      averageAmount: chartData.reduce((sum, d) => sum + d.averageAmount, 0) / 12,
      count: chartData.reduce((sum, d) => sum + d.count, 0),
      netAmount: chartData.reduce((sum, d) => sum + d.netAmount, 0),
      taxAmount: chartData.reduce((sum, d) => sum + d.taxAmount, 0),
      totalAmount: chartData.reduce((sum, d) => sum + d.totalAmount, 0),
    }),
    [chartData],
  );

  return (
    <div className="space-y-4 pt-4">
      <div className="flex items-center gap-4">
        <Select
          label="Año"
          placeholder="Seleccionar año"
          value={selectedYear}
          onChange={(key) => {
            if (key) {
              setSelectedYear(key.toString());
            }
          }}
        >
          {yearOptions.map((year) => (
            <SelectItem key={year} id={year}>
              {year}
            </SelectItem>
          ))}
        </Select>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Total Ventas</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-bold text-2xl">{formatCurrency(totals.totalAmount)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Neto</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-bold text-2xl">{formatCurrency(totals.netAmount)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">IVA</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-bold text-2xl">{formatCurrency(totals.taxAmount)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Documentos</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-bold text-2xl">{formatNumber(totals.count)}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Ventas Mensuales {selectedYear}</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer height={400} width="100%">
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis
                tickFormatter={(value: number | undefined) =>
                  value !== undefined ? formatCurrency(value) : "N/A"
                }
              />
              <Tooltip
                formatter={(value: number | undefined) =>
                  value !== undefined ? formatCurrency(value) : "N/A"
                }
                labelStyle={{ color: "#000" }}
              />
              <Legend />
              <Bar dataKey="totalAmount" fill="#3b82f6" name="Total" />
              <Bar dataKey="netAmount" fill="#10b981" name="Neto" />
              <Bar dataKey="taxAmount" fill="#f59e0b" name="IVA" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}

function PurchasesComparison() {
  const { data: summary } = useSuspenseQuery(dteAnalyticsKeys.purchases());

  const chartData = useMemo(() => {
    // Group data by month across all years
    const monthYearMap = new Map<string, Array<(typeof summary)[0] & { year: string }>>();
    for (const item of summary) {
      const [year, month] = item.period.split("-");
      const monthKey = month; // 01-12
      if (!monthYearMap.has(monthKey)) {
        monthYearMap.set(monthKey, []);
      }
      const items = monthYearMap.get(monthKey);
      if (items) {
        items.push({ ...item, year });
      }
    }

    // Build chart data structure
    return Array.from({ length: 12 }, (_, i) => {
      const monthKey = (i + 1).toString().padStart(2, "0");
      const monthItems = monthYearMap.get(monthKey) || [];
      const dataPoint = {
        month: MONTH_NAMES[i],
      } as Record<string, string | number>;

      // Add year columns
      for (const item of monthItems) {
        dataPoint[item.year] = item.totalAmount;
      }

      return dataPoint;
    });
  }, [summary]);

  const years = useMemo(() => {
    const yearSet = new Set<string>();
    for (const item of summary) {
      const [year] = item.period.split("-");
      yearSet.add(year);
    }
    return Array.from(yearSet).sort().reverse();
  }, [summary]);

  const colors = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6"];

  return (
    <div className="space-y-4 pt-4">
      <Card>
        <CardHeader>
          <CardTitle>Comparación de Compras (Todos los Años)</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer height={400} width="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis
                tickFormatter={(value: number | undefined) =>
                  value !== undefined ? formatCurrency(value) : "N/A"
                }
              />
              <Tooltip
                formatter={(value: number | undefined) =>
                  value !== undefined ? formatCurrency(value) : "N/A"
                }
                labelStyle={{ color: "#000" }}
              />
              <Legend />
              {years.map((year, idx) => (
                <Line
                  key={year}
                  dataKey={year}
                  stroke={colors[idx % colors.length]}
                  name={year}
                  dot
                  strokeWidth={2}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}

function SalesComparison() {
  const { data: summary } = useSuspenseQuery(dteAnalyticsKeys.sales());

  const chartData = useMemo(() => {
    // Group data by month across all years
    const monthYearMap = new Map<string, Array<(typeof summary)[0] & { year: string }>>();
    for (const item of summary) {
      const [year, month] = item.period.split("-");
      const monthKey = month; // 01-12
      if (!monthYearMap.has(monthKey)) {
        monthYearMap.set(monthKey, []);
      }
      const items = monthYearMap.get(monthKey);
      if (items) {
        items.push({ ...item, year });
      }
    }

    // Build chart data structure
    return Array.from({ length: 12 }, (_, i) => {
      const monthKey = (i + 1).toString().padStart(2, "0");
      const monthItems = monthYearMap.get(monthKey) || [];
      const dataPoint = {
        month: MONTH_NAMES[i],
      } as Record<string, string | number>;

      // Add year columns
      for (const item of monthItems) {
        dataPoint[item.year] = item.totalAmount;
      }

      return dataPoint;
    });
  }, [summary]);

  const years = useMemo(() => {
    const yearSet = new Set<string>();
    for (const item of summary) {
      const [year] = item.period.split("-");
      yearSet.add(year);
    }
    return Array.from(yearSet).sort().reverse();
  }, [summary]);

  const colors = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6"];

  return (
    <div className="space-y-4 pt-4">
      <Card>
        <CardHeader>
          <CardTitle>Comparación de Ventas (Todos los Años)</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer height={400} width="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis
                tickFormatter={(value: number | undefined) =>
                  value !== undefined ? formatCurrency(value) : "N/A"
                }
              />
              <Tooltip
                formatter={(value: number | undefined) =>
                  value !== undefined ? formatCurrency(value) : "N/A"
                }
                labelStyle={{ color: "#000" }}
              />
              <Legend />
              {years.map((year, idx) => (
                <Line
                  key={year}
                  dataKey={year}
                  stroke={colors[idx % colors.length]}
                  name={year}
                  dot
                  strokeWidth={2}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
