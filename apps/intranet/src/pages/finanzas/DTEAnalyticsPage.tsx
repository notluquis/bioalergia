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
  const [comparisonYear1, setComparisonYear1] = useState((currentYear - 1).toString());
  const [comparisonYear2, setComparisonYear2] = useState(currentYear.toString());

  const yearOptions = useMemo(() => {
    const years = [];
    for (let y = 2020; y <= currentYear + 1; y++) {
      years.push(y.toString());
    }
    return years;
  }, [currentYear]);

  return (
    <div className="container mx-auto space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-bold text-3xl">Análisis de DTEs</h1>
          <p className="text-default-500 text-sm">
            Visualización de compras y ventas con documentos tributarios electrónicos
          </p>
        </div>
        <BarChart3 className="size-8 text-primary" />
      </div>

      <Tabs aria-label="DTE Analytics Tabs" defaultSelectedKey="purchases-monthly">
        <Tabs.ListContainer>
          <Tabs.List
            aria-label="Opciones de visualización"
            className="rounded-lg bg-default-50/50 p-1"
          >
            <Tabs.Tab id="purchases-monthly">
              <BarChart3 className="size-4" />
              Compras Mensual
            </Tabs.Tab>
            <Tabs.Tab id="sales-monthly">
              <BarChart3 className="size-4" />
              Ventas Mensual
            </Tabs.Tab>
            <Tabs.Tab id="purchases-comparison">
              <TrendingUp className="size-4" />
              Compras Comparativa
            </Tabs.Tab>
            <Tabs.Tab id="sales-comparison">
              <TrendingUp className="size-4" />
              Ventas Comparativa
            </Tabs.Tab>
          </Tabs.List>
        </Tabs.ListContainer>

        <Tabs.Tab id="purchases-monthly">
          <PurchasesMonthlySummary
            selectedYear={selectedYear}
            setSelectedYear={setSelectedYear}
            yearOptions={yearOptions}
          />
        </Tabs.Tab>

        <Tabs.Tab id="sales-monthly">
          <SalesMonthlySummary
            selectedYear={selectedYear}
            setSelectedYear={setSelectedYear}
            yearOptions={yearOptions}
          />
        </Tabs.Tab>

        <Tabs.Tab id="purchases-comparison">
          <PurchasesComparison
            comparisonYear1={comparisonYear1}
            comparisonYear2={comparisonYear2}
            setComparisonYear1={setComparisonYear1}
            setComparisonYear2={setComparisonYear2}
            yearOptions={yearOptions}
          />
        </Tabs.Tab>

        <Tabs.Tab id="sales-comparison">
          <SalesComparison
            comparisonYear1={comparisonYear1}
            comparisonYear2={comparisonYear2}
            setComparisonYear1={setComparisonYear1}
            setComparisonYear2={setComparisonYear2}
            yearOptions={yearOptions}
          />
        </Tabs.Tab>
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
            // key is already a string | null
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
            // key is already a string | null
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

interface ComparisonProps {
  comparisonYear1: string;
  comparisonYear2: string;
  setComparisonYear1: (year: string) => void;
  setComparisonYear2: (year: string) => void;
  yearOptions: string[];
}

function PurchasesComparison({
  comparisonYear1,
  comparisonYear2,
  setComparisonYear1,
  setComparisonYear2,
  yearOptions,
}: ComparisonProps) {
  const { data: comparison } = useSuspenseQuery(
    dteAnalyticsKeys.comparison(Number(comparisonYear1), Number(comparisonYear2), "purchases"),
  );

  const chartData = useMemo(
    () =>
      comparison.map((item, index) => ({
        ...item,
        month: MONTH_NAMES[index],
      })),
    [comparison],
  );

  return (
    <div className="space-y-4 pt-4">
      <div className="flex items-center gap-4">
        <Select
          label="Año 1"
          placeholder="Seleccionar año"
          value={comparisonYear1}
          onChange={(key) => {
            // key is already a string | null
            if (key) {
              setComparisonYear1(key.toString());
            }
          }}
        >
          {yearOptions.map((year) => (
            <SelectItem key={year} id={year}>
              {year}
            </SelectItem>
          ))}
        </Select>
        <Select
          label="Año 2"
          placeholder="Seleccionar año"
          value={comparisonYear2}
          onChange={(key) => {
            // key is already a string | null
            if (key) {
              setComparisonYear2(key.toString());
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

      <Card>
        <CardHeader>
          <CardTitle>
            Comparación de Compras: {comparisonYear1} vs {comparisonYear2}
          </CardTitle>
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
              <Line
                dataKey="year1Value"
                stroke="#3b82f6"
                strokeWidth={2}
                name={comparisonYear1}
                dot
              />
              <Line
                dataKey="year2Value"
                stroke="#10b981"
                strokeWidth={2}
                name={comparisonYear2}
                dot
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}

function SalesComparison({
  comparisonYear1,
  comparisonYear2,
  setComparisonYear1,
  setComparisonYear2,
  yearOptions,
}: ComparisonProps) {
  const { data: comparison } = useSuspenseQuery(
    dteAnalyticsKeys.comparison(Number(comparisonYear1), Number(comparisonYear2), "sales"),
  );

  const chartData = useMemo(
    () =>
      comparison.map((item, index) => ({
        ...item,
        month: MONTH_NAMES[index],
      })),
    [comparison],
  );

  return (
    <div className="space-y-4 pt-4">
      <div className="flex items-center gap-4">
        <Select
          label="Año 1"
          placeholder="Seleccionar año"
          value={comparisonYear1}
          onChange={(key) => {
            // key is already a string | null
            if (key) {
              setComparisonYear1(key.toString());
            }
          }}
        >
          {yearOptions.map((year) => (
            <SelectItem key={year} id={year}>
              {year}
            </SelectItem>
          ))}
        </Select>
        <Select
          label="Año 2"
          placeholder="Seleccionar año"
          value={comparisonYear2}
          onChange={(key) => {
            // key is already a string | null
            if (key) {
              setComparisonYear2(key.toString());
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

      <Card>
        <CardHeader>
          <CardTitle>
            Comparación de Ventas: {comparisonYear1} vs {comparisonYear2}
          </CardTitle>
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
              <Line
                dataKey="year1Value"
                stroke="#3b82f6"
                strokeWidth={2}
                name={comparisonYear1}
                dot
              />
              <Line
                dataKey="year2Value"
                stroke="#10b981"
                strokeWidth={2}
                name={comparisonYear2}
                dot
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
