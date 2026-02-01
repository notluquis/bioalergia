import { Button, Card, Spinner } from "@heroui/react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import dayjs from "dayjs";
import "dayjs/locale/es";
import {
  Calendar as CalendarIcon,
  DollarSign,
  Home,
  Package,
  RefreshCcw,
  Syringe,
} from "lucide-react";
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

const getThisMonth = () => ({
  from: dayjs().startOf("month").format("YYYY-MM-DD"),
  to: dayjs().endOf("month").format("YYYY-MM-DD"),
});
const getLastMonth = () => ({
  from: dayjs().subtract(1, "month").startOf("month").format("YYYY-MM-DD"),
  to: dayjs().subtract(1, "month").endOf("month").format("YYYY-MM-DD"),
});

// --- Types ---

interface AnalyticsTrendPoint {
  date?: string;
  label?: string;
  year?: number;
  month?: number;
  isoWeek?: number;
  amountPaid: number;
  events: number;
  dosageMl: number;
  induccionCount?: number;
  mantencionCount?: number;
  domicilioCount?: number;
}

interface PieChartData {
  name: string;
  value: number;
  color?: string;
}

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
    calendarIds: searchParams.calendarId,
  };

  const hasValidDates = !!filters.from && !!filters.to;

  // DEBUG: Filter Diagnostics (Requested by User)
  console.group("📊 Analytics Page Filters Debug");
  console.log("1. Raw Search Params:", searchParams);
  console.log("2. Active Filters:", filters);
  console.log("3. API Query Config:", calendarQueries.treatmentAnalytics(filters).queryKey);
  console.groupEnd();

  const { data, isLoading, refetch } = useQuery({
    ...calendarQueries.treatmentAnalytics(filters),
    enabled: hasValidDates,
  });

  const handleDateChange = (from: string, to: string) => {
    void navigate({ search: { ...searchParams, from, to } });
  };

  const handleQuickRange = (range: { from: string; to: string }) => {
    void navigate({ search: { ...searchParams, ...range } });
  };

  const handleRefresh = async () => {
    await refetch();
  };

  // Calculate Data
  const totalRevenue = data?.totals.amountPaid || 0;
  const totalTreatmentCount = data?.totals.events || 0;
  const totalMl = data?.totals.dosageMl || 0;
  const domicilioCount = data?.totals.domicilioCount || 0;
  const clinicCount = totalTreatmentCount - domicilioCount;

  const induccionCount = data?.totals.induccionCount || 0;
  const mantencionCount = data?.totals.mantencionCount || 0;
  const unclassifiedCount = totalTreatmentCount - induccionCount - mantencionCount;

  const trendData: AnalyticsTrendPoint[] | undefined =
    period === "day"
      ? data?.byDate
      : period === "week"
        ? data?.byWeek.map((d) => ({ ...d, label: `S${d.isoWeek}` }))
        : data?.byMonth.map((d) => ({
            ...d,
            label: dayjs(`${d.year}-${d.month}-01`).format("MMM"),
          }));

  const pieDataStage: PieChartData[] = [
    { name: "Inducción", value: induccionCount },
    { name: "Mantención", value: mantencionCount },
    { name: unclassifiedCount > 0 ? "Sin Clasif." : "", value: unclassifiedCount },
  ].filter((d) => d.value > 0);

  const pieDataLocation: PieChartData[] = [
    { name: "Domicilio", value: domicilioCount },
    { name: "Clínica", value: clinicCount },
  ].filter((d) => d.value > 0);

  return (
    <div className="space-y-6 max-w-400 mx-auto pb-10">
      <AnalyticsHeader
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

function AnalyticsCharts({
  trendData,
  pieDataStage,
  pieDataLocation,
  period,
}: {
  trendData: AnalyticsTrendPoint[] | undefined;
  pieDataStage: PieChartData[];
  pieDataLocation: PieChartData[];
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
  data: PieChartData[];
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

const CustomTooltip = ({
  active,
  payload,
  label,
}: {
  active?: boolean;
  // payload is complicated in Recharts, but we can type strictly what we expect
  // biome-ignore lint/suspicious/noExplicitAny: Recharts payload is loosely typed library-side
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
  data: AnalyticsTrendPoint[];
  period: "day" | "week" | "month";
}) {
  const columns: ColumnDef<AnalyticsTrendPoint>[] = [
    {
      accessorKey: period === "day" ? "date" : "label",
      header: "Periodo",
      cell: ({ row }) => {
        // Safe access as we defined interface
        const val = (period === "day" ? row.original.date : row.original.label) || "";
        if (period === "day") return dayjs(val).format("dddd DD MMM");
        return val;
      },
      enableSorting: false,
    },
    {
      accessorKey: "events",
      header: "Tratamientos",
      cell: ({ row }) => <span className="font-medium">{row.original.events}</span>,
    },
    {
      accessorKey: "amountPaid",
      header: "Ingresos",
      cell: ({ row }) => formatCurrency(row.original.amountPaid),
    },
    {
      accessorKey: "dosageMl",
      header: "Consumo",
      cell: ({ row }) => {
        const val = row.original.dosageMl;
        return val ? `${val.toFixed(1)} ml` : "-";
      },
    },
    {
      accessorKey: "domicilioCount",
      header: "Domicilio",
      cell: ({ row }) => {
        const val = row.original.domicilioCount || 0;
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

// --- Sub Components ---

function AnalyticsHeader({
  period,
  isFilterOpen,
  isLoading,
  onToggleFilter,
  onSetPeriod,
  onRefresh,
}: {
  period: "day" | "week" | "month";
  isFilterOpen: boolean;
  isLoading: boolean;
  onToggleFilter: () => void;
  onSetPeriod: (p: "day" | "week" | "month") => void;
  onRefresh: () => void;
}) {
  return (
    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          Análisis de Tratamientos
          {isLoading && <Spinner size="sm" color="current" />}
        </h1>
        <p className="text-small text-default-500">
          Visualiza el rendimiento operativo y financiero
        </p>
      </div>
      <div className="flex items-center gap-2">
        <div className="bg-default-100 rounded-lg p-1 flex items-center">
          {(["day", "week", "month"] as const).map((p) => (
            <button
              type="button"
              key={p}
              onClick={() => onSetPeriod(p)}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                period === p
                  ? "bg-background text-foreground shadow-sm"
                  : "text-default-500 hover:text-foreground"
              }`}
            >
              {p === "day" ? "Día" : p === "week" ? "Semana" : "Mes"}
            </button>
          ))}
        </div>
        <Button
          isIconOnly
          variant="ghost"
          size="sm"
          onPress={onToggleFilter}
          className={isFilterOpen ? "bg-primary/10 text-primary" : ""}
        >
          <CalendarIcon className="w-4 h-4" />
        </Button>
        <Button isIconOnly variant="ghost" size="sm" onPress={onRefresh}>
          <RefreshCcw className="w-4 h-4" />
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
    <Card className="bg-content2/50 border-default-100">
      <Card.Content className="p-4 flex flex-col sm:flex-row gap-4 items-end">
        <div className="flex-1 w-full grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-default-500">Desde</label>
            <input
              type="date"
              className="bg-default-100 rounded-md px-3 py-2 text-sm text-foreground"
              value={filters.from || ""}
              onChange={(e) => onDateChange(e.target.value, filters.to || "")}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-default-500">Hasta</label>
            <input
              type="date"
              className="bg-default-100 rounded-md px-3 py-2 text-sm text-foreground"
              value={filters.to || ""}
              onChange={(e) => onDateChange(filters.from || "", e.target.value)}
            />
          </div>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="ghost" onPress={() => onQuickRange(getThisWeek())}>
            Esta Semana
          </Button>
          <Button size="sm" variant="ghost" onPress={() => onQuickRange(getLastMonth())}>
            Mes Pasado
          </Button>
          <Button size="sm" variant="ghost" onPress={() => onQuickRange(getThisMonth())}>
            Este Mes
          </Button>
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
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <KpiCard
        title="Tratamientos"
        value={totalTreatmentCount}
        icon={Syringe}
        trend="Total periodo"
      />
      <KpiCard
        title="Ingresos"
        value={formatCurrency(totalRevenue)}
        icon={DollarSign}
        trend="Facturado"
        color="success"
      />
      <KpiCard
        title="Consumo (ml)"
        value={totalMl.toFixed(1)}
        icon={Package}
        trend="Total ml"
        color="warning"
      />
      <KpiCard
        title="Domicilios"
        value={domicilioCount}
        icon={Home}
        trend={`${((domicilioCount / (totalTreatmentCount || 1)) * 100).toFixed(0)}% del total`}
        color="secondary"
      />
    </div>
  );
}

function KpiCard({
  title,
  value,
  icon: Icon,
  trend,
  color = "primary",
}: {
  title: string;
  value: string | number;
  icon: any;
  trend: string;
  color?: "primary" | "success" | "warning" | "secondary";
}) {
  return (
    <Card className="shadow-sm border-default-200">
      <Card.Content className="p-4 flex items-center justify-between">
        <div>
          <p className="text-xs text-default-500 font-medium uppercase">{title}</p>
          <p className="text-2xl font-bold text-foreground mt-1">{value}</p>
          <p className="text-xs text-default-400 mt-1">{trend}</p>
        </div>
        <div className={`p-2 rounded-lg bg-${color}/10 text-${color}`}>
          <Icon className="w-5 h-5" />
        </div>
      </Card.Content>
    </Card>
  );
}
