import {
  Button,
  Card,
  Dropdown,
  DropdownItem,
  DropdownMenu,
  DropdownTrigger,
  Spinner,
} from "@heroui/react";
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

// --- Main Page Component ---

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Component logic is centralized for analytics
export function TreatmentAnalyticsPage() {
  const navigate = routeApi.useNavigate();
  const searchParams = routeApi.useSearch();
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  const selectedMonth = searchParams.month;
  const isMonthSelected = Boolean(selectedMonth);
  const period: "day" | "week" | "month" = isMonthSelected
    ? searchParams.period === "day" || searchParams.period === "week"
      ? searchParams.period
      : "week"
    : "month";
  const granularity = period === "day" ? "day" : period === "week" ? "week" : "month";

  const resolvedRange = isMonthSelected
    ? getMonthRange(selectedMonth || "")
    : searchParams.from && searchParams.to
      ? { from: searchParams.from, to: searchParams.to }
      : getDefaultRange();

  const filters: TreatmentAnalyticsFilters = {
    from: resolvedRange.from,
    to: resolvedRange.to,
    calendarIds: searchParams.calendarId,
  };

  const hasValidDates = Boolean(filters.from) && Boolean(filters.to);

  const { data, isLoading, refetch } = useQuery({
    ...calendarQueries.treatmentAnalytics(filters, granularity),
    enabled: hasValidDates,
  });

  const handleDateChange = (from: string, to: string) => {
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

  // Calculate Data
  const totalExpected = data?.totals.amountExpected || 0;
  const totalPaid = data?.totals.amountPaid || 0;
  const totalTreatmentCount = data?.totals.events || 0;
  const totalMl = data?.totals.dosageMl || 0;
  const domicilioCount = data?.totals.domicilioCount || 0;

  const trendData: AnalyticsTrendPoint[] | undefined =
    period === "day"
      ? data?.byDate
      : period === "week"
        ? data?.byWeek?.map((d) => ({ ...d, label: `S${d.isoWeek}` }))
        : data?.byMonth?.map((d) => ({
            ...d,
            label: dayjs(`${d.year}-${d.month}-01`).format("MMM YYYY"),
          }));

  return (
    <div className="mx-auto max-w-7xl space-y-4 px-3 py-3 pb-6 sm:px-4 lg:px-6">
      <AnalyticsHeader
        isMonthSelected={isMonthSelected}
        period={period}
        isFilterOpen={isFilterOpen}
        isLoading={isLoading}
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
          filters={filters}
          onDateChange={handleDateChange}
          onMonthSelect={handleMonthSelect}
        />
      )}

      {isLoading && !data ? (
        <div className="flex h-80 items-center justify-center">
          <Spinner size="lg" color="current" className="text-default-300" />
        </div>
      ) : (
        <>
          <AnalyticsKpiGrid
            totalTreatmentCount={totalTreatmentCount}
            totalExpected={totalExpected}
            totalPaid={totalPaid}
            totalMl={totalMl}
            domicilioCount={domicilioCount}
          />

          <AnalyticsCharts trendData={trendData || []} byMonth={data?.byMonth} period={period} />

          <AnalyticsDetailTable data={trendData || []} period={period} />
        </>
      )}
    </div>
  );
}

function AnalyticsCharts({
  trendData,
  byMonth,
  period,
}: {
  trendData: AnalyticsTrendPoint[];
  byMonth?: AnalyticsTrendPoint[];
  period: "day" | "week" | "month";
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
          <h3 className="font-semibold text-foreground text-sm sm:text-base">
            Tendencia de Actividad
          </h3>
        </Card.Header>
        <Card.Content>
          <div className="h-52 min-h-52 w-full">
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

      {/* Distribution by Month */}
      {monthlyData.length > 0 && (
        <>
          {/* Por Etapa - Monthly */}
          <div className="space-y-2.5">
            <h3 className="font-semibold text-foreground text-sm">Por Etapa</h3>
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
            <h3 className="font-semibold text-foreground text-sm">Por Ubicación</h3>
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
        <h3 className="font-semibold text-foreground text-xs sm:text-sm">{title}</h3>
      </Card.Header>
      <Card.Content className="p-2">
        <div className="h-24 min-h-24 w-full">
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
        <p className="mb-1.5 font-semibold text-foreground text-xs">
          {dayjs(label).isValid() ? dayjs(label).format("DD MMM YYYY") : label}
        </p>
        <div className="space-y-0.5">
          {payload.map((p) => (
            <div key={p.name} className="flex items-center gap-1.5">
              <div className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: p.color }} />
              <span className="text-xs text-default-500 capitalize">{p.name}:</span>
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
        <h3 className="font-semibold text-base text-foreground">Detalle del Periodo</h3>
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
      <p className="font-semibold text-foreground text-xs sm:text-sm">{displayText}</p>
    </div>
  );
}

function AnalyticsHeader({
  isMonthSelected,
  period,
  isFilterOpen,
  isLoading,
  onToggleFilter,
  onSetPeriod,
  onSelectMonth,
  onRefresh,
}: {
  isMonthSelected: boolean;
  period: "day" | "week" | "month";
  isFilterOpen: boolean;
  isLoading: boolean;
  onToggleFilter: () => void;
  onSetPeriod: (p: "day" | "week") => void;
  onSelectMonth: (month: string) => void;
  onRefresh: () => void;
}) {
  const prevMonth = dayjs().subtract(1, "month").format("YYYY-MM");
  const currentMonth = dayjs().format("YYYY-MM");
  const nextMonth = dayjs().add(1, "month").format("YYYY-MM");

  return (
    <div className="flex w-full flex-col items-start justify-between gap-2 sm:flex-row sm:items-center">
      {isLoading && (
        <div className="flex items-center gap-2">
          <Spinner size="sm" color="current" />
          <span className="text-default-500 text-sm">Cargando datos...</span>
        </div>
      )}
      <div className="ml-auto flex flex-wrap items-center gap-2">
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
        {isMonthSelected && (
          <Dropdown>
            <DropdownTrigger>
              <Button size="sm" variant="outline">
                Ver detalle por: {period === "day" ? "Día" : "Semana"}
              </Button>
            </DropdownTrigger>
            <DropdownMenu
              aria-label="Seleccionar nivel de detalle"
              selectedKeys={[period]}
              onSelectionChange={(keys) => {
                const selected = Array.from(keys)[0] as "day" | "week";
                if (selected === "day" || selected === "week") {
                  onSetPeriod(selected);
                }
              }}
            >
              <DropdownItem key="week">Por Semana</DropdownItem>
              <DropdownItem key="day">Por Día</DropdownItem>
            </DropdownMenu>
          </Dropdown>
        )}
        <Button
          isIconOnly
          variant="ghost"
          size="sm"
          onPress={onToggleFilter}
          className={isFilterOpen ? "bg-primary/10 text-primary" : ""}
        >
          <CalendarIcon className="h-4 w-4" />
        </Button>
        <Button isIconOnly variant="ghost" size="sm" onPress={onRefresh}>
          <RefreshCcw className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

function AnalyticsFilters({
  filters,
  onDateChange,
  onMonthSelect,
}: {
  filters: TreatmentAnalyticsFilters;
  onDateChange: (from: string, to: string) => void;
  onMonthSelect: (month: string) => void;
}) {
  return (
    <Card className="border-default-100 bg-content2/50">
      <Card.Content className="flex flex-col items-end gap-3 p-3 sm:flex-row sm:gap-4 sm:p-4">
        <div className="grid w-full flex-1 grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1">
            <label htmlFor="date-from" className="text-default-500 text-xs">
              Desde
            </label>
            <input
              id="date-from"
              type="date"
              className="rounded-md bg-default-100 px-2.5 py-1.5 text-foreground text-sm"
              value={filters.from || ""}
              onChange={(e) => onDateChange(e.target.value, filters.to || "")}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="date-to" className="text-default-500 text-xs">
              Hasta
            </label>
            <input
              id="date-to"
              type="date"
              className="rounded-md bg-default-100 px-2.5 py-1.5 text-foreground text-sm"
              value={filters.to || ""}
              onChange={(e) => onDateChange(filters.from || "", e.target.value)}
            />
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="ghost"
            onPress={() => onMonthSelect(dayjs().subtract(1, "month").format("YYYY-MM"))}
          >
            Mes anterior
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onPress={() => onMonthSelect(dayjs().format("YYYY-MM"))}
          >
            Mes actual
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onPress={() => onMonthSelect(dayjs().add(1, "month").format("YYYY-MM"))}
          >
            Mes siguiente
          </Button>
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
  return (
    <Card className="border-default-200 shadow-sm">
      <Card.Content className="flex flex-row items-center gap-2.5 p-2.5 sm:p-3">
        <div className={`rounded-lg p-2 bg-${color}/10 text-${color} shrink-0`}>
          <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
        </div>
        <div className="flex flex-col justify-center gap-0.5">
          <p className="font-medium text-default-500 text-xs uppercase">{title}</p>
          <p className="font-bold text-foreground text-lg sm:text-xl">{value}</p>
          <p className="text-default-400 text-xs">{trend}</p>
        </div>
      </Card.Content>
    </Card>
  );
}
