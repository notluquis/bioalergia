import {
  Button,
  Card,
  DateField,
  DateRangePicker,
  Description,
  Label,
  RangeCalendar,
  Skeleton,
  Spinner,
} from "@heroui/react";
import { parseDate } from "@internationalized/date";
import { useQuery } from "@tanstack/react-query";
import { getRouteApi } from "@tanstack/react-router";
import dayjs from "dayjs";
import type React from "react";
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
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Sector,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

dayjs.locale("es");

import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/data-table/DataTable";
import { calendarQueries } from "@/features/calendar/queries";
import type { TreatmentAnalytics, TreatmentAnalyticsFilters } from "@/features/calendar/types";
import { formatCurrency } from "@/lib/utils";

const routeApi = getRouteApi("/_authed/operations/supplies-analytics");

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
const KPI_ICON_STYLES: Record<
  "primary" | "secondary" | "success" | "warning",
  { bgClass: string; textClass: string }
> = {
  primary: { bgClass: "bg-primary/10", textClass: "text-primary" },
  secondary: { bgClass: "bg-secondary/10", textClass: "text-secondary" },
  success: { bgClass: "bg-success/10", textClass: "text-success" },
  warning: { bgClass: "bg-warning/10", textClass: "text-warning" },
};

// --- Quick Ranges Helpers ---
const getDefaultRange = () => ({
  from: dayjs().subtract(3, "month").startOf("month").format("YYYY-MM-DD"),
  to: dayjs().add(1, "month").endOf("month").format("YYYY-MM-DD"),
});

const getMonthRange = (month: string) => {
  const base = dayjs(`${month}-01`);
  if (!base.isValid()) {
    return getDefaultRange();
  }
  return {
    from: base.startOf("month").format("YYYY-MM-DD"),
    to: base.endOf("month").format("YYYY-MM-DD"),
  };
};

// --- Types ---

interface AnalyticsTrendPoint {
  date?: string;
  label?: string;
  year?: number;
  month?: number;
  isoWeek?: number;
  amountExpected: number;
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

type AnalyticsPeriod = "day" | "week" | "month";
type AnalyticsSearchParams = ReturnType<typeof routeApi.useSearch>;

function resolvePeriod(isMonthSelected: boolean, periodValue: string | undefined): AnalyticsPeriod {
  if (!isMonthSelected) {
    return "month";
  }
  if (periodValue === "day" || periodValue === "week") {
    return periodValue;
  }
  return "week";
}

function resolveGranularity(period: AnalyticsPeriod): "day" | "week" | "month" {
  if (period === "day") {
    return "day";
  }
  if (period === "week") {
    return "week";
  }
  return "month";
}

function resolveRange(searchParams: AnalyticsSearchParams, selectedMonth: string | undefined) {
  if (selectedMonth) {
    return getMonthRange(selectedMonth);
  }
  if (searchParams.from && searchParams.to) {
    return { from: searchParams.from, to: searchParams.to };
  }
  return getDefaultRange();
}

function buildTrendData(
  data: TreatmentAnalytics | undefined,
  period: AnalyticsPeriod,
): AnalyticsTrendPoint[] | undefined {
  if (period === "day") {
    return data?.byDate;
  }
  if (period === "week") {
    return data?.byWeek?.map((d) => ({ ...d, label: `S${d.isoWeek}` }));
  }
  return data?.byMonth?.map((d) => ({
    ...d,
    label: dayjs(`${d.year}-${d.month}-01`).format("MMM YYYY"),
  }));
}

function getTotals(data: TreatmentAnalytics | undefined) {
  return {
    domicilioCount: data?.totals.domicilioCount || 0,
    totalExpected: data?.totals.amountExpected || 0,
    totalMl: data?.totals.dosageMl || 0,
    totalPaid: data?.totals.amountPaid || 0,
    totalTreatmentCount: data?.totals.events || 0,
  };
}

// --- Main Page Component ---

export function TreatmentAnalyticsPage() {
  const navigate = routeApi.useNavigate();
  const searchParams = routeApi.useSearch();
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [dateRangeError, setDateRangeError] = useState<null | string>(null);

  const selectedMonth = searchParams.month;
  const isMonthSelected = Boolean(selectedMonth);
  const period = resolvePeriod(isMonthSelected, searchParams.period);
  const granularity = resolveGranularity(period);
  const resolvedRange = resolveRange(searchParams, selectedMonth);

  const filters: TreatmentAnalyticsFilters = {
    from: resolvedRange.from,
    to: resolvedRange.to,
    calendarIds: searchParams.calendarId,
  };

  const hasValidDates = Boolean(filters.from) && Boolean(filters.to);

  const { data, isLoading, isRefetching, refetch } = useQuery({
    ...calendarQueries.treatmentAnalytics(filters, granularity),
    enabled: hasValidDates,
    staleTime: 1000 * 60 * 2, // 2 minutos
    gcTime: 1000 * 60 * 5, // 5 minutos (antes cacheTime)
  });

  const handleDateChange = (from: string, to: string) => {
    // Validar si ambas fechas están presentes
    if (from && to) {
      if (dayjs(from).isAfter(dayjs(to))) {
        setDateRangeError("La fecha 'desde' debe ser anterior a 'hasta'");
        return;
      }
      setDateRangeError(null);
    }

    void navigate({
      search: (prev) => ({
        ...prev,
        from,
        to,
        month: undefined,
        period: "month",
      }),
    });
  };

  const handleMonthSelect = (month: string) => {
    const range = getMonthRange(month);
    void navigate({
      search: (prev) => ({
        ...prev,
        month,
        from: range.from,
        to: range.to,
        period: "week",
      }),
    });
  };

  const handleSetPeriod = (nextPeriod: "day" | "week") => {
    if (!isMonthSelected) {
      return;
    }
    void navigate({
      search: (prev) => ({
        ...prev,
        period: nextPeriod,
      }),
    });
  };

  const handleRefresh = async () => {
    await refetch();
  };

  const totals = getTotals(data);
  const trendData = buildTrendData(data, period);

  return (
    <div className="mx-auto max-w-7xl space-y-4 px-3 py-3 pb-6 sm:px-4 lg:px-6">
      <AnalyticsHeader
        isMonthSelected={isMonthSelected}
        period={period}
        isFilterOpen={isFilterOpen}
        isLoading={isLoading}
        isRefetching={isRefetching}
        onToggleFilter={() => setIsFilterOpen(!isFilterOpen)}
        onSetPeriod={handleSetPeriod}
        onSelectMonth={handleMonthSelect}
        onRefresh={handleRefresh}
      />

      <PeriodIndicator
        selectedMonth={selectedMonth}
        from={resolvedRange.from}
        to={resolvedRange.to}
        isMonthSelected={isMonthSelected}
      />

      {isFilterOpen && (
        <AnalyticsFilters
          dateRangeError={dateRangeError}
          filters={filters}
          onDateChange={handleDateChange}
          onMonthSelect={handleMonthSelect}
        />
      )}

      <TreatmentAnalyticsContent
        data={data}
        granularity={granularity}
        isLoading={isLoading}
        period={period}
        totals={totals}
        trendData={trendData}
      />
    </div>
  );
}

function TreatmentAnalyticsContent({
  data,
  granularity,
  isLoading,
  period,
  totals,
  trendData,
}: {
  data: TreatmentAnalytics | undefined;
  granularity: "day" | "week" | "month";
  isLoading: boolean;
  period: AnalyticsPeriod;
  totals: ReturnType<typeof getTotals>;
  trendData: AnalyticsTrendPoint[] | undefined;
}) {
  if (isLoading && !data) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-72 rounded-md" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Skeleton className="h-24 rounded-xl" />
          <Skeleton className="h-24 rounded-xl" />
          <Skeleton className="h-24 rounded-xl" />
          <Skeleton className="h-24 rounded-xl" />
        </div>
        <Skeleton className="h-80 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <>
      <AnalyticsKpiGrid
        totalTreatmentCount={totals.totalTreatmentCount}
        totalExpected={totals.totalExpected}
        totalPaid={totals.totalPaid}
        totalMl={totals.totalMl}
        domicilioCount={totals.domicilioCount}
      />
      {data && (trendData?.length ?? 0) === 0 ? (
        <Card className="border-default-100">
          <Card.Content className="p-8 text-center">
            <Description className="text-default-500">
              No hay datos disponibles para el período seleccionado. Intenta ajustar los filtros o
              seleccionar otro rango de fechas.
            </Description>
          </Card.Content>
        </Card>
      ) : (
        <>
          <AnalyticsCharts
            trendData={trendData || []}
            byMonth={data?.byMonth}
            period={period}
            granularity={granularity}
          />
          <AnalyticsDetailTable data={trendData || []} period={period} />
        </>
      )}
    </>
  );
}

function AnalyticsCharts({
  trendData,
  byMonth,
  period,
  granularity,
}: {
  byMonth?: AnalyticsTrendPoint[];
  granularity: "day" | "week" | "month";
  period: "day" | "week" | "month";
  trendData: AnalyticsTrendPoint[];
}) {
  const monthlyData = (byMonth || []).map((month) => {
    const totalEvents = month.events || 0;
    const unclassifiedCount =
      totalEvents - (month.induccionCount || 0) - (month.mantencionCount || 0);

    return {
      label: dayjs(`${month.year}-${month.month}-01`).format("MMM YYYY"),
      pieDataStage: [
        { name: "Inducción", value: month.induccionCount || 0 },
        { name: "Mantención", value: month.mantencionCount || 0 },
        ...(unclassifiedCount > 0 ? [{ name: "Sin Clasif.", value: unclassifiedCount }] : []),
      ].filter((d) => d.value > 0),
      pieDataLocation: [
        { name: "Domicilio", value: month.domicilioCount || 0 },
        { name: "Clínica", value: totalEvents - (month.domicilioCount || 0) },
      ].filter((d) => d.value > 0),
    };
  });

  return (
    <div className="space-y-6">
      {/* Trend Chart */}
      <Card className="border-default-200 shadow-sm">
        <Card.Header className="pb-1.5">
          <span className="font-semibold text-foreground text-sm sm:text-base">
            Tendencia de Actividad
          </span>
        </Card.Header>
        <Card.Content>
          <div className="h-52 min-h-52 w-full min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={trendData?.toReversed() ?? []}
                margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={COLORS.success} stopOpacity={0.1} />
                    <stop offset="95%" stopColor={COLORS.success} stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorPaid" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={COLORS.warning} stopOpacity={0.1} />
                    <stop offset="95%" stopColor={COLORS.warning} stopOpacity={0} />
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
                  tickFormatter={(val) => `$${(val / 1000000).toFixed(1)}m`}
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
                  dataKey="amountExpected"
                  name="Ingresos Esperado ($)"
                  stroke={COLORS.success}
                  fillOpacity={1}
                  fill="url(#colorRevenue)"
                  strokeWidth={2}
                />

                <Area
                  yAxisId="left"
                  type="monotone"
                  dataKey="amountPaid"
                  name="Ingresos Pagado ($)"
                  stroke={COLORS.warning}
                  fillOpacity={0.5}
                  fill="url(#colorPaid)"
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
          </div>
        </Card.Content>
      </Card>

      {/* Distribution by Month - Only show when viewing full month */}
      {granularity === "month" && monthlyData.length > 0 && (
        <>
          {/* Por Etapa - Monthly */}
          <div className="space-y-2.5">
            <span className="font-semibold text-foreground text-sm">Por Etapa</span>
            <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {monthlyData.map((month) => (
                <PieChartCard
                  key={`etapa-${month.label}`}
                  title={month.label}
                  data={month.pieDataStage}
                  colors={PIE_COLORS_STAGE}
                />
              ))}
            </div>
          </div>

          {/* Por Ubicación - Monthly */}
          <div className="space-y-2.5">
            <span className="font-semibold text-foreground text-sm">Por Ubicación</span>
            <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {monthlyData.map((month) => (
                <PieChartCard
                  key={`ubicacion-${month.label}`}
                  title={month.label}
                  data={month.pieDataLocation}
                  colors={PIE_COLORS_LOCATION}
                />
              ))}
            </div>
          </div>
        </>
      )}
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
    <Card className="flex-1 border-default-200 shadow-sm">
      <Card.Header className="pb-1.5">
        <span className="font-semibold text-foreground text-xs sm:text-sm">{title}</span>
      </Card.Header>
      <Card.Content className="p-2">
        <div className="h-24 min-h-24 w-full min-w-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={28}
                outerRadius={42}
                paddingAngle={5}
                dataKey="value"
                shape={(props, index) => <Sector {...props} fill={colors[index % colors.length]} />}
              />
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
  label?: string; // payload contains tooltip data for each series in the chart
  payload?: Array<{ color: string; name: string; value: number }>;
}) => {
  if (active && payload && payload.length) {
    return (
      <div className="rounded-lg border border-default-200 bg-content1 p-2 text-xs shadow-lg">
        <Description className="mb-1.5 font-semibold text-foreground text-xs">
          {dayjs(label).isValid() ? dayjs(label).format("DD MMM YYYY") : label}
        </Description>
        <div className="space-y-1">
          {payload.map((p) => (
            <div key={p.name} className="flex items-center gap-1.5">
              <div className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: p.color }} />
              <span className="text-default-500 text-xs capitalize">{p.name}:</span>
              <span className="font-medium text-foreground text-xs">
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
        if (period === "day") {
          return dayjs(val).format("dddd DD MMM");
        }
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
      accessorKey: "amountExpected",
      header: "Ingresos Esperado",
      cell: ({ row }) => formatCurrency(row.original.amountExpected),
    },
    {
      accessorKey: "amountPaid",
      header: "Ingresos Pagado",
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
            <Home className="h-3.5 w-3.5" />
            <span>{val}</span>
          </div>
        ) : (
          "-"
        );
      },
    },
  ];

  return (
    <Card className="border-default-200 shadow-sm">
      <Card.Header className="pb-1.5">
        <span className="font-semibold text-base text-foreground">Detalle del Periodo</span>
      </Card.Header>
      <Card.Content>
        <DataTable
          columns={columns}
          data={data}
          enablePagination={true}
          enableToolbar={false}
          pageSizeOptions={[5, 10, 20]}
          scrollMaxHeight="min(60dvh, 700px)"
        />
      </Card.Content>
    </Card>
  );
}

// --- Sub Components ---

function PeriodIndicator({
  selectedMonth,
  from,
  to,
  isMonthSelected,
}: {
  selectedMonth?: string;
  from: string;
  to: string;
  isMonthSelected: boolean;
}) {
  let displayText = "";

  if (isMonthSelected && selectedMonth) {
    const monthDate = dayjs(`${selectedMonth}-01`);
    displayText = monthDate.format("MMMM YYYY");
  } else {
    const fromDate = dayjs(from).format("D MMM");
    const toDate = dayjs(to).format("D MMM YYYY");
    displayText = `${fromDate} - ${toDate}`;
  }

  return (
    <div className="flex w-fit items-center gap-2 rounded-lg bg-primary/10 px-3 py-2">
      <CalendarIcon className="h-3.5 w-3.5 text-primary" />
      <Description className="font-semibold text-foreground text-xs sm:text-sm">
        {displayText}
      </Description>
    </div>
  );
}

function AnalyticsHeader({
  isMonthSelected,
  period,
  isFilterOpen,
  isLoading,
  isRefetching,
  onToggleFilter,
  onSetPeriod,
  onSelectMonth,
  onRefresh,
}: {
  isFilterOpen: boolean;
  isLoading: boolean;
  isMonthSelected: boolean;
  isRefetching: boolean;
  onRefresh: () => void;
  onSelectMonth: (month: string) => void;
  onSetPeriod: (p: "day" | "week") => void;
  onToggleFilter: () => void;
  period: "day" | "week" | "month";
}) {
  const prevMonth = dayjs().subtract(1, "month").format("YYYY-MM");
  const currentMonth = dayjs().format("YYYY-MM");
  const nextMonth = dayjs().add(1, "month").format("YYYY-MM");

  return (
    <div className="space-y-3">
      <div className="flex w-full items-center justify-between">
        {isLoading && (
          <div className="flex items-center gap-2">
            <Skeleton className="h-3 w-3 rounded-full" />
            <span className="text-default-500 text-sm">Cargando datos...</span>
          </div>
        )}
        <div className="ml-auto flex items-center gap-2">
          <Button
            isDisabled={isRefetching}
            isIconOnly
            variant="ghost"
            size="sm"
            onPress={onRefresh}
          >
            {isRefetching ? (
              <Spinner size="sm" color="current" />
            ) : (
              <RefreshCcw className="h-4 w-4" />
            )}
          </Button>
          <Button
            isIconOnly
            variant="ghost"
            size="sm"
            onPress={onToggleFilter}
            className={isFilterOpen ? "bg-primary/10 text-primary" : ""}
          >
            <CalendarIcon className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1 rounded-lg bg-default-100 p-1">
          <Button
            size="sm"
            variant={period === "week" ? "primary" : "ghost"}
            onPress={() => {
              if (isMonthSelected) {
                onSetPeriod("week");
              } else {
                onSelectMonth(currentMonth);
              }
            }}
            className="text-xs"
          >
            Por Semana
          </Button>
          <Button
            size="sm"
            variant={period === "day" ? "primary" : "ghost"}
            onPress={() => {
              if (isMonthSelected) {
                onSetPeriod("day");
              } else {
                onSelectMonth(currentMonth);
              }
            }}
            className="text-xs"
          >
            Por Día
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onPress={() => onSelectMonth(prevMonth)}>
            Mes anterior
          </Button>
          <Button size="sm" variant="outline" onPress={() => onSelectMonth(currentMonth)}>
            Mes actual
          </Button>
          <Button size="sm" variant="outline" onPress={() => onSelectMonth(nextMonth)}>
            Mes siguiente
          </Button>
        </div>
      </div>
    </div>
  );
}

function AnalyticsFilters({
  dateRangeError,
  filters,
  onDateChange,
  onMonthSelect,
}: {
  dateRangeError: null | string;
  filters: TreatmentAnalyticsFilters;
  onDateChange: (from: string, to: string) => void;
  onMonthSelect: (month: string) => void;
}) {
  const applyQuickRange = (days: number) => {
    const to = dayjs().endOf("day");
    const from = to.subtract(days, "day").startOf("day");
    onDateChange(from.format("YYYY-MM-DD"), to.format("YYYY-MM-DD"));
  };
  return (
    <Card className="border-default-100 bg-content2/50">
      <Card.Content className="space-y-4 p-3 sm:p-4">
        {/* Current Range Indicator */}
        <div className="rounded-lg bg-default-50 p-2.5">
          <Description className="text-default-500 text-xs">
            <span className="font-semibold">Rango actual:</span>{" "}
            {dayjs(filters.from).format("D MMM")} - {dayjs(filters.to).format("D MMM YYYY")}
          </Description>
        </div>

        {/* Quick Range Presets */}
        <div className="space-y-2">
          <Description className="font-semibold text-default-500 text-xs uppercase tracking-wide">
            Rangos rápidos
          </Description>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="ghost"
              onPress={() => applyQuickRange(7)}
              className="text-xs"
            >
              Últimos 7 días
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onPress={() => applyQuickRange(30)}
              className="text-xs"
            >
              Últimas 4 semanas
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onPress={() => applyQuickRange(90)}
              className="text-xs"
            >
              Últimos 3 meses
            </Button>
          </div>
        </div>

        {/* Date Inputs */}
        <div className="space-y-3">
          <Description className="font-semibold text-default-500 text-xs uppercase tracking-wide">
            Rango personalizado
          </Description>
          <DateRangePicker
            className="w-full"
            onChange={(value) => {
              if (!value) {
                return;
              }
              onDateChange(value.start.toString(), value.end.toString());
            }}
            value={
              filters.from && filters.to
                ? { end: parseDate(filters.to), start: parseDate(filters.from) }
                : undefined
            }
          >
            <Label>Rango personalizado</Label>
            <DateField.Group>
              <DateField.Input slot="start">
                {(segment) => <DateField.Segment segment={segment} />}
              </DateField.Input>
              <DateRangePicker.RangeSeparator />
              <DateField.Input slot="end">
                {(segment) => <DateField.Segment segment={segment} />}
              </DateField.Input>
              <DateField.Suffix>
                <DateRangePicker.Trigger>
                  <DateRangePicker.TriggerIndicator />
                </DateRangePicker.Trigger>
              </DateField.Suffix>
            </DateField.Group>
            <DateRangePicker.Popover>
              <RangeCalendar visibleDuration={{ months: 2 }} />
            </DateRangePicker.Popover>
          </DateRangePicker>

          {/* Error Message */}
          {dateRangeError && (
            <Description className="rounded-md bg-danger/10 p-2 text-danger text-xs">
              {dateRangeError}
            </Description>
          )}
        </div>

        {/* Month Shortcuts */}
        <div className="space-y-2 border-default-200 border-t pt-3">
          <Description className="font-semibold text-default-500 text-xs uppercase tracking-wide">
            Atajos de mes
          </Description>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="ghost"
              onPress={() => onMonthSelect(dayjs().subtract(1, "month").format("YYYY-MM"))}
              className="text-xs"
            >
              Mes anterior
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onPress={() => onMonthSelect(dayjs().format("YYYY-MM"))}
              className="text-xs"
            >
              Mes actual
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onPress={() => onMonthSelect(dayjs().add(1, "month").format("YYYY-MM"))}
              className="text-xs"
            >
              Mes siguiente
            </Button>
          </div>
        </div>
      </Card.Content>
    </Card>
  );
}

function AnalyticsKpiGrid({
  totalTreatmentCount,
  totalExpected,
  totalPaid,
  totalMl,
  domicilioCount,
}: {
  totalTreatmentCount: number;
  totalExpected: number;
  totalPaid: number;
  totalMl: number;
  domicilioCount: number;
}) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-5">
      <KpiCard
        title="Tratamientos"
        value={totalTreatmentCount}
        icon={Syringe}
        trend="Total periodo"
      />

      <KpiCard
        title="Ingresos Esperado"
        value={formatCurrency(totalExpected)}
        icon={DollarSign}
        trend="Esperado"
        color="success"
      />

      <KpiCard
        title="Ingresos Pagado"
        value={formatCurrency(totalPaid)}
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
  color?: "primary" | "success" | "warning" | "secondary";
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  trend: string;
  value: string | number;
}) {
  const iconStyle = KPI_ICON_STYLES[color];
  return (
    <Card className="border-default-200 shadow-sm">
      <Card.Content className="flex flex-row items-center gap-2.5 p-2.5 sm:p-3">
        <div className={`shrink-0 rounded-lg p-2 ${iconStyle.bgClass} ${iconStyle.textClass}`}>
          <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
        </div>
        <div className="flex flex-col justify-center gap-0.5">
          <Description className="font-medium text-default-500 text-xs uppercase">
            {title}
          </Description>
          <span className="font-bold text-foreground text-lg sm:text-xl">{value}</span>
          <Description className="text-default-400 text-xs">{trend}</Description>
        </div>
      </Card.Content>
    </Card>
  );
}
