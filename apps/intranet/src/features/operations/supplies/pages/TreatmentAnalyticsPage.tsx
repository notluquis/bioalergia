import { Button, Card, Chip, DateField, DateInputGroup, Label, Spinner } from "@heroui/react";
import { parseDate } from "@internationalized/date";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import dayjs from "dayjs";
import "dayjs/locale/es";
import {
  Calendar as CalendarIcon,
  ChevronDown,
  ChevronUp,
  DollarSign,
  Home,
  Package,
  RefreshCcw,
  Syringe,
} from "lucide-react";
import type React from "react";
import { useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

dayjs.locale("es");

import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/data-table/DataTable";
import { calendarQueries } from "@/features/calendar/queries";
import type { TreatmentAnalyticsFilters } from "@/features/calendar/types";
import { formatCurrency } from "@/lib/utils";
import { Route } from "@/routes/_authed/operations/supplies-analytics";

// --- Constants & Config ---

const COLORS = {
  primary: "#006FEE",
  secondary: "#9353d3",
  success: "#17c964",
  warning: "#f5a524",
  danger: "#f31260",
  default: "#71717a",
  grid: "#e4e4e7",
  text: "#52525b",
};

const PIE_COLORS_STAGE = [COLORS.primary, COLORS.secondary, COLORS.default];
const PIE_COLORS_LOCATION = [COLORS.secondary, COLORS.primary];

// --- Quick Ranges Helpers ---
const getThisWeek = () => ({
  from: dayjs().startOf("week").format("YYYY-MM-DD"),
  to: dayjs().endOf("week").format("YYYY-MM-DD"),
});
const getLastWeek = () => ({
  from: dayjs().subtract(1, "week").startOf("week").format("YYYY-MM-DD"),
  to: dayjs().subtract(1, "week").endOf("week").format("YYYY-MM-DD"),
});
const getThisMonth = () => ({
  from: dayjs().startOf("month").format("YYYY-MM-DD"),
  to: dayjs().endOf("month").format("YYYY-MM-DD"),
});
const getLastMonth = () => ({
  from: dayjs().subtract(1, "month").startOf("month").format("YYYY-MM-DD"),
  to: dayjs().subtract(1, "month").endOf("month").format("YYYY-MM-DD"),
});

// --- Main Page Component ---

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Component logic is centralized for analytics
export default function TreatmentAnalyticsPage() {
  const navigate = useNavigate({ from: Route.fullPath });
  const searchParams = Route.useSearch();
  const [period, setPeriod] = useState<"day" | "week" | "month">(searchParams.period || "week");
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  const filters: TreatmentAnalyticsFilters = {
    from: searchParams.from || getThisMonth().from,
    to: searchParams.to || getThisMonth().to,
  };

  const hasValidDates = !!filters.from && !!filters.to;

  // DEBUG: Filter Diagnostics (Requested by User)
  console.group("📊 Analytics Page Filters Debug");
  console.log("1. Raw Search Params:", searchParams);
  console.log("2. Active Filters:", filters);
  console.log(
    "3. API Query Config:",
    // biome-ignore lint/suspicious/noExplicitAny: Debugging
    (calendarQueries.treatmentAnalytics(filters) as any).queryKey,
  );
  console.groupEnd();

  const { data, isLoading, isError, error, refetch } = useQuery({
    ...calendarQueries.treatmentAnalytics(filters),
    enabled: hasValidDates,
  });

  const handleDateChange = (from: string, to: string) => {
    void navigate({ search: { ...searchParams, from, to } });
  };

  const handleQuickRange = (range: { from: string; to: string }) => {
    void navigate({ search: { ...searchParams, from: range.from, to: range.to } });
    setIsFilterOpen(false);
  };

  const handleRefresh = () => void refetch();

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center p-12 gap-4 text-danger">
        <p>Error cargando analytics: {(error as Error).message}</p>
        <Button onClick={handleRefresh} variant="ghost" className="text-danger">
          Reintentar
        </Button>
      </div>
    );
  }

  // Calculate Data
  const totalRevenue = data?.totals.amountPaid || 0;
  const totalTreatmentCount = data?.totals.events || 0;
  const totalMl = data?.totals.dosageMl || 0;
  const domicilioCount = data?.totals.domicilioCount || 0;
  const clinicCount = totalTreatmentCount - domicilioCount;

  const induccionCount = data?.totals.induccionCount || 0;
  const mantencionCount = data?.totals.mantencionCount || 0;
  const unclassifiedCount = totalTreatmentCount - induccionCount - mantencionCount;

  const trendData =
    period === "day"
      ? data?.byDate
      : period === "week"
        ? data?.byWeek.map((d) => ({ ...d, label: `S${d.isoWeek}` }))
        : data?.byMonth.map((d) => ({
            ...d,
            label: dayjs(`${d.year}-${d.month}-01`).format("MMM"),
          }));

  const pieDataStage = [
    { name: "Inducción", value: induccionCount },
    { name: "Mantención", value: mantencionCount },
    { name: unclassifiedCount > 0 ? "Sin Clasif." : "", value: unclassifiedCount },
  ].filter((d) => d.value > 0);

  const pieDataLocation = [
    { name: "Domicilio", value: domicilioCount },
    { name: "Clínica", value: clinicCount },
  ].filter((d) => d.value > 0);

  return (
    <div className="space-y-6 max-w-400 mx-auto pb-10">
      <AnalyticsHeader
        filters={filters}
        period={period}
        isFilterOpen={isFilterOpen}
        isLoading={isLoading}
        onToggleFilter={() => setIsFilterOpen(!isFilterOpen)}
        onSetPeriod={setPeriod}
        onRefresh={handleRefresh}
      />

      {isFilterOpen && (
        <AnalyticsFilters
          filters={filters}
          onDateChange={handleDateChange}
          onQuickRange={handleQuickRange}
        />
      )}

      {isLoading && !data ? (
        <div className="h-64 flex items-center justify-center">
          <Spinner size="lg" color="current" className="text-default-300" />
        </div>
      ) : (
        <>
          <AnalyticsKpiGrid
            totalTreatmentCount={totalTreatmentCount}
            totalRevenue={totalRevenue}
            totalMl={totalMl}
            domicilioCount={domicilioCount}
          />
          <AnalyticsCharts
            trendData={trendData}
            pieDataStage={pieDataStage}
            pieDataLocation={pieDataLocation}
            period={period}
          />
          <AnalyticsDetailTable data={trendData || []} period={period} />
        </>
      )}
    </div>
  );
}

// --- Sub Components ---

function AnalyticsHeader({
  filters,
  period,
  isFilterOpen,
  isLoading,
  onToggleFilter,
  onSetPeriod,
  onRefresh,
}: {
  filters: TreatmentAnalyticsFilters;
  period: "day" | "week" | "month";
  isFilterOpen: boolean;
  isLoading: boolean;
  onToggleFilter: () => void;
  onSetPeriod: (p: "day" | "week" | "month") => void;
  onRefresh: () => void;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      {/* Title handled globally by Header Breadcrumbs */}
      <div />

      <div className="flex items-center gap-2 bg-default-50 p-1.5 rounded-xl border border-default-100">
        <Button
          size="sm"
          variant="ghost"
          onClick={onToggleFilter}
          className="text-default-600 gap-2"
        >
          <CalendarIcon className="w-4 h-4" />
          <span className="font-medium text-xs">
            {filters.from ? dayjs(filters.from).format("DD MMM") : ""} -{" "}
            {filters.to ? dayjs(filters.to).format("DD MMM") : ""}
          </span>
          {isFilterOpen ? (
            <ChevronUp className="w-3 h-3 text-default-400" />
          ) : (
            <ChevronDown className="w-3 h-3 text-default-400" />
          )}
        </Button>

        <div className="h-4 w-px bg-default-200 mx-1" />

        <div className="flex gap-1">
          {(["day", "week", "month"] as const).map((p) => (
            <button
              type="button"
              key={p}
              onClick={() => onSetPeriod(p)}
              className={`px-3 py-1 text-xs font-medium rounded-lg transition-all ${
                period === p
                  ? "bg-white text-foreground shadow-sm ring-1 ring-default-200"
                  : "text-default-500 hover:text-foreground hover:bg-default-200/50"
              }`}
            >
              {p === "day" ? "Día" : p === "week" ? "Semana" : "Mes"}
            </button>
          ))}
        </div>

        <Button
          size="sm"
          isIconOnly
          variant="ghost"
          onClick={onRefresh}
          isDisabled={isLoading}
          className="text-default-400 hover:text-primary"
        >
          <RefreshCcw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
        </Button>
      </div>
    </div>
  );
}

function AnalyticsFilters({
  filters,
  onDateChange,
  onQuickRange,
}: {
  filters: TreatmentAnalyticsFilters;
  onDateChange: (from: string, to: string) => void;
  onQuickRange: (range: { from: string; to: string }) => void;
}) {
  return (
    <Card className="shadow-sm border-default-200 bg-default-50/50">
      <Card.Content className="p-3 grid grid-cols-1 lg:grid-cols-[1fr,auto] gap-4">
        <div className="flex gap-4 items-end">
          <div className="max-w-37.5">
            <Label className="text-xs mb-1.5 ml-1 text-default-500">Desde</Label>
            <DateField
              value={filters.from ? parseDate(filters.from) : null}
              onChange={(d) => d && onDateChange(d.toString(), filters.to || d.toString())}
            >
              <DateInputGroup className="bg-white border-default-200 text-sm">
                <DateInputGroup.Input>
                  {(segment) => <DateInputGroup.Segment segment={segment} />}
                </DateInputGroup.Input>
              </DateInputGroup>
            </DateField>
          </div>
          <div className="max-w-37.5">
            <Label className="text-xs mb-1.5 ml-1 text-default-500">Hasta</Label>
            <DateField
              value={filters.to ? parseDate(filters.to) : null}
              onChange={(d) => d && onDateChange(filters.from || d.toString(), d.toString())}
            >
              <DateInputGroup className="bg-white border-default-200 text-sm">
                <DateInputGroup.Input>
                  {(segment) => <DateInputGroup.Segment segment={segment} />}
                </DateInputGroup.Input>
              </DateInputGroup>
            </DateField>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 items-end">
          {[
            { label: "Esta Semana", fn: getThisWeek },
            { label: "Semana Pasada", fn: getLastWeek },
            { label: "Este Mes", fn: getThisMonth },
            { label: "Mes Pasado", fn: getLastMonth },
          ].map((item) => (
            <Chip
              key={item.label}
              variant="soft"
              className="cursor-pointer hover:bg-default-200 transition-colors"
              onClick={() => onQuickRange(item.fn())}
            >
              {item.label}
            </Chip>
          ))}
        </div>
      </Card.Content>
    </Card>
  );
}

function AnalyticsKpiGrid({
  totalTreatmentCount,
  totalRevenue,
  totalMl,
  domicilioCount,
}: {
  totalTreatmentCount: number;
  totalRevenue: number;
  totalMl: number;
  domicilioCount: number;
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <KpiCard title="Tratamientos" value={totalTreatmentCount} icon={Syringe} color="primary" />
      <KpiCard
        title="Ingresos"
        value={formatCurrency(totalRevenue)}
        icon={DollarSign}
        color="success"
        caption="Generados en el periodo"
      />
      <KpiCard
        title="Consumo (ml)"
        value={totalMl.toFixed(1)}
        icon={Package}
        color="warning"
        caption="Volumen total"
      />
      <KpiCard
        title="Domicilio"
        value={`${domicilioCount}`}
        icon={Home}
        color="secondary"
        caption={`${((domicilioCount / (totalTreatmentCount || 1)) * 100).toFixed(1)}% del total`}
      />
    </div>
  );
}

function AnalyticsCharts({
  trendData,
  pieDataStage,
  pieDataLocation,
  period,
}: {
  // biome-ignore lint/suspicious/noExplicitAny: loose chart data types
  trendData: any[] | undefined;
  // biome-ignore lint/suspicious/noExplicitAny: loose chart data types
  pieDataStage: any[];
  // biome-ignore lint/suspicious/noExplicitAny: loose chart data types
  pieDataLocation: any[];
  period: "day" | "week" | "month";
}) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-[2fr,1fr] gap-4">
      {/* Trend Chart */}
      <Card className="shadow-sm border-default-200">
        <Card.Header className="pb-2">
          <h3 className="text-base font-semibold text-foreground">Tendencia de Actividad</h3>
        </Card.Header>
        <Card.Content className="h-60">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={trendData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={COLORS.success} stopOpacity={0.1} />
                  <stop offset="95%" stopColor={COLORS.success} stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorVolume" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={COLORS.primary} stopOpacity={0.1} />
                  <stop offset="95%" stopColor={COLORS.primary} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={COLORS.grid} />
              <XAxis
                dataKey={period === "day" ? "date" : "label"}
                stroke={COLORS.default}
                tick={{ fontSize: 12 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(val) => (period === "day" ? dayjs(val).format("D MMM") : val)}
              />
              <YAxis
                yAxisId="left"
                stroke={COLORS.default}
                tick={{ fontSize: 12 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(val) => `$${val / 1000}k`}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                stroke={COLORS.default}
                tick={{ fontSize: 12 }}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              <Area
                yAxisId="left"
                type="monotone"
                dataKey="amountPaid"
                name="Ingresos ($)"
                stroke={COLORS.success}
                fillOpacity={1}
                fill="url(#colorRevenue)"
                strokeWidth={2}
              />
              <Area
                yAxisId="right"
                type="monotone"
                dataKey="events"
                name="Tratamientos"
                stroke={COLORS.primary}
                fillOpacity={1}
                fill="url(#colorVolume)"
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </Card.Content>
      </Card>

      {/* Distribution Charts */}
      <div className="grid grid-cols-1 gap-4">
        <PieChartCard title="Por Etapa" data={pieDataStage} colors={PIE_COLORS_STAGE} />
        <PieChartCard title="Por Ubicación" data={pieDataLocation} colors={PIE_COLORS_LOCATION} />
      </div>
    </div>
  );
}

function PieChartCard({
  title,
  data,
  colors,
}: {
  title: string;
  // biome-ignore lint/suspicious/noExplicitAny: loose chart data types
  data: any[];
  colors: string[];
}) {
  return (
    <Card className="shadow-sm border-default-200 flex-1">
      <Card.Header className="pb-0">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      </Card.Header>
      <Card.Content className="h-32">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={35}
              outerRadius={50}
              paddingAngle={5}
              dataKey="value"
            >
              {data.map((entry, index) => (
                <Cell key={entry.name} fill={colors[index % colors.length]} />
              ))}
            </Pie>
            <Tooltip />
            <Legend
              verticalAlign="middle"
              align="right"
              layout="vertical"
              iconType="circle"
              wrapperStyle={{ fontSize: "11px" }}
            />
          </PieChart>
        </ResponsiveContainer>
      </Card.Content>
    </Card>
  );
}

function KpiCard({
  title,
  value,
  icon: Icon,
  color,
  caption,
}: {
  title: string;
  value: string | number;
  icon: React.ElementType;
  color: "primary" | "secondary" | "success" | "warning";
  caption?: string;
}) {
  const bgClasses = {
    primary: "bg-primary/10 text-primary",
    secondary: "bg-secondary/10 text-secondary",
    success: "bg-success/10 text-success",
    warning: "bg-warning/10 text-warning",
  };

  return (
    <Card className="shadow-sm border-default-200">
      <Card.Content className="p-3 flex flex-row items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-default-500">{title}</p>
          <p className="text-2xl font-bold tracking-tight text-foreground">{value}</p>
          {caption && <p className="text-xs text-default-400 mt-0.5">{caption}</p>}
        </div>
        <div className={`p-2 rounded-lg ${bgClasses[color]}`}>
          <Icon className="w-4 h-4" />
        </div>
      </Card.Content>
    </Card>
  );
}

const CustomTooltip = ({
  active,
  payload,
  label,
}: {
  active?: boolean;
  // biome-ignore lint/suspicious/noExplicitAny: Recharts payload is loosely typed
  payload?: any[];
  label?: string;
}) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-content1 border border-default-200 p-3 rounded-lg shadow-lg text-xs">
        <p className="font-semibold text-foreground mb-2">
          {dayjs(label).isValid() ? dayjs(label).format("DD MMM YYYY") : label}
        </p>
        <div className="space-y-1">
          {/* biome-ignore lint/suspicious/noExplicitAny: Recharts payload is loosely typed */}
          {payload.map((p: any) => (
            <div key={p.name} className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
              <span className="text-default-500 capitalize">{p.name}:</span>
              <span className="font-medium text-foreground">
                {p.name.includes("Ingresos") ? formatCurrency(p.value) : p.value}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }
  return null;
};

function AnalyticsDetailTable({
  data,
  period,
}: {
  // biome-ignore lint/suspicious/noExplicitAny: loose chart data types
  data: any[];
  period: "day" | "week" | "month";
}) {
  // biome-ignore lint/suspicious/noExplicitAny: loose typing for dynamic table
  const columns: ColumnDef<any>[] = [
    {
      accessorKey: period === "day" ? "date" : "label",
      header: "Periodo",
      cell: ({ row }) => {
        const val = row.getValue(period === "day" ? "date" : "label") as string;
        if (period === "day") return dayjs(val).format("dddd DD MMM");
        return val;
      },
      enableSorting: false,
    },
    {
      accessorKey: "events",
      header: "Tratamientos",
      cell: ({ row }) => <span className="font-medium">{row.getValue("events")}</span>,
    },
    {
      accessorKey: "amountPaid",
      header: "Ingresos",
      cell: ({ row }) => formatCurrency(row.getValue("amountPaid")),
    },
    {
      accessorKey: "dosageMl",
      header: "Consumo",
      cell: ({ row }) => {
        const val = row.getValue("dosageMl") as number;
        return val ? `${val.toFixed(1)} ml` : "-";
      },
    },
    {
      accessorKey: "domicilioCount",
      header: "Domicilio",
      cell: ({ row }) => {
        const val = row.getValue("domicilioCount") as number;
        return val > 0 ? (
          <div className="flex items-center gap-1.5 text-secondary">
            <Home className="w-3.5 h-3.5" />
            <span>{val}</span>
          </div>
        ) : (
          "-"
        );
      },
    },
  ];

  return (
    <Card className="shadow-sm border-default-200">
      <Card.Header className="pb-2">
        <h3 className="text-base font-semibold text-foreground">Detalle del Periodo</h3>
      </Card.Header>
      <Card.Content>
        <DataTable
          columns={columns}
          data={data}
          enablePagination={true}
          enableToolbar={false}
          pageSizeOptions={[5, 10, 20]}
        />
      </Card.Content>
    </Card>
  );
}
