import {
  Alert,
  Button,
  Card,
  Chip,
  Input,
  Label,
  ListBox,
  ProgressBar,
  Select,
  Skeleton,
  Surface,
  TextField,
  Tooltip,
} from "@heroui/react";
import type { Key } from "@heroui/react";
import { ExternalLink, Stethoscope } from "lucide-react";
import { useDeferredValue, useMemo, useState } from "react";
import { useSkinTestAnalytics } from "./skin-tests-queries";

const EXAM_TYPE_OPTIONS = [
  { label: "Todos", value: "__ALL__" },
  { label: "Alimentario", value: "Alimentario" },
  { label: "Aeroalérgenos", value: "Aeroalérgenos" },
  { label: "Ácaros", value: "Ácaros" },
  { label: "AINES", value: "AINES" },
  { label: "Multitest", value: "Multitest" },
  { label: "Prick test", value: "Prick test" },
  { label: "Sin clasificar", value: "Sin clasificar" },
] as const;

const formatNumber = (value: number) => value.toLocaleString("es-CL");

function formatMonth(month: string) {
  const [year, rawMonth] = month.split("-");
  if (!year || !rawMonth) return month;
  return new Intl.DateTimeFormat("es-CL", { month: "short", year: "numeric" }).format(
    new Date(Number(year), Number(rawMonth) - 1, 1)
  );
}

function pct(value: number, total: number) {
  return total > 0 ? (value / total) * 100 : 0;
}

export function SkinTestAnalyticsPanel() {
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query.trim());
  const [examType, setExamType] = useState<string>("__ALL__");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const filters = useMemo(
    () => ({
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
      examType: examType === "__ALL__" ? undefined : examType,
      pageSize: 20,
      query: deferredQuery || undefined,
    }),
    [dateFrom, dateTo, deferredQuery, examType]
  );

  const { data: stats, error, isLoading } = useSkinTestAnalytics(filters);
  const maxMonth = Math.max(...(stats?.byMonth.map((row) => row.total) ?? [0]));
  const maxPatientTests = Math.max(...(stats?.topPatients.map((row) => row.totalTests) ?? [0]));

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <SkinTestAnalyticsFilters
          dateFrom={dateFrom}
          dateTo={dateTo}
          examType={examType}
          query={query}
          setDateFrom={setDateFrom}
          setDateTo={setDateTo}
          setExamType={setExamType}
          setQuery={setQuery}
        />
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <Skeleton className="h-28 rounded-2xl" />
          <Skeleton className="h-28 rounded-2xl" />
          <Skeleton className="h-28 rounded-2xl" />
          <Skeleton className="h-28 rounded-2xl" />
        </div>
        <Skeleton className="h-72 rounded-2xl" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col gap-4">
        <SkinTestAnalyticsFilters
          dateFrom={dateFrom}
          dateTo={dateTo}
          examType={examType}
          query={query}
          setDateFrom={setDateFrom}
          setDateTo={setDateTo}
          setExamType={setExamType}
          setQuery={setQuery}
        />
        <Alert status="danger">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Description>
              {error instanceof Error
                ? error.message
                : "Error al cargar análisis de tests cutáneos"}
            </Alert.Description>
          </Alert.Content>
        </Alert>
      </div>
    );
  }

  const totalTests = stats?.totalTests ?? 0;

  return (
    <div className="flex flex-col gap-4">
      <SkinTestAnalyticsFilters
        dateFrom={dateFrom}
        dateTo={dateTo}
        examType={examType}
        query={query}
        setDateFrom={setDateFrom}
        setDateTo={setDateTo}
        setExamType={setExamType}
        setQuery={setQuery}
      />

      {!stats || totalTests === 0 ? (
        <Card className="border-default-200 shadow-sm">
          <Card.Content className="flex h-48 flex-col items-center justify-center gap-2 p-5 text-center">
            <Stethoscope className="text-foreground-300" size={24} />
            <p className="text-sm text-foreground-500">
              No hay tests cutáneos importados para los filtros actuales.
            </p>
          </Card.Content>
        </Card>
      ) : (
        <>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
            <MetricCard label="Tests" value={stats.totalTests} />
            <MetricCard label="Pacientes" value={stats.totalPatients} />
            <MetricCard label="Resultados" value={stats.totalResults} />
            <MetricCard label="Pápula positiva" value={stats.positiveAllergenResults} />
            <MetricCard
              label="Con RUT"
              value={stats.withRut}
              suffix={`${pct(stats.withRut, stats.totalTests).toFixed(1)}%`}
            />
            <MetricCard
              label="Sin RUT"
              value={stats.withoutRut}
              suffix={`${pct(stats.withoutRut, stats.totalTests).toFixed(1)}%`}
            />
          </div>

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(20rem,0.8fr)]">
            <Card className="border-default-200 shadow-sm">
              <Card.Header className="pb-2">
                <div className="flex flex-col gap-1">
                  <h3 className="text-base font-semibold text-foreground">Tipos de examen</h3>
                  <p className="text-sm text-foreground-500">
                    {stats.dateFrom && stats.dateTo
                      ? `${stats.dateFrom} a ${stats.dateTo}`
                      : "Rango calculado desde tests importados"}
                  </p>
                </div>
              </Card.Header>
              <Card.Content className="space-y-3 p-4 pt-0">
                {stats.byExamType.map((row) => (
                  <DistributionRow
                    key={row.examType}
                    label={row.examType}
                    total={row.total}
                    value={pct(row.total, stats.totalTests)}
                  />
                ))}
              </Card.Content>
            </Card>

            <Card className="border-default-200 shadow-sm">
              <Card.Header className="pb-2">
                <h3 className="text-base font-semibold text-foreground">Meses</h3>
              </Card.Header>
              <Card.Content className="space-y-3 p-4 pt-0">
                {stats.byMonth.map((row) => (
                  <DistributionRow
                    key={row.month}
                    label={formatMonth(row.month)}
                    total={row.total}
                    value={pct(row.total, maxMonth)}
                  />
                ))}
              </Card.Content>
            </Card>
          </div>

          <div className="grid gap-4 xl:grid-cols-[minmax(20rem,0.8fr)_minmax(0,1fr)]">
            <Card className="border-default-200 shadow-sm">
              <Card.Header className="pb-2">
                <h3 className="text-base font-semibold text-foreground">Pacientes frecuentes</h3>
              </Card.Header>
              <Card.Content className="space-y-3 p-4 pt-0">
                {stats.topPatients.map((patient) => (
                  <div key={`${patient.patientRut ?? ""}-${patient.patientName ?? ""}`}>
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-foreground">
                          {patient.patientName ?? "Paciente sin nombre"}
                        </p>
                        <p className="text-xs text-foreground-500">
                          {patient.patientRut ?? "Sin RUT"} · Último {patient.lastTestDate ?? "-"}
                        </p>
                      </div>
                      <Chip size="sm" variant="soft">
                        {patient.totalTests}
                      </Chip>
                    </div>
                    <ProgressBar
                      aria-label={`Tests de ${patient.patientName ?? patient.patientRut ?? "paciente"}`}
                      className="mt-2"
                      value={pct(patient.totalTests, maxPatientTests)}
                    >
                      <ProgressBar.Track>
                        <ProgressBar.Fill />
                      </ProgressBar.Track>
                    </ProgressBar>
                  </div>
                ))}
              </Card.Content>
            </Card>

            <Card className="border-default-200 shadow-sm">
              <Card.Header className="pb-2">
                <h3 className="text-base font-semibold text-foreground">Tests recientes</h3>
              </Card.Header>
              <Card.Content className="divide-y divide-default-200 p-0">
                {stats.recentTests.map((test) => (
                  <div
                    key={test.id}
                    className="grid gap-3 px-4 py-3 md:grid-cols-[7rem_minmax(0,1fr)_8rem_auto]"
                  >
                    <span className="text-sm tabular-nums text-foreground-500">
                      {test.testDate}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">
                        {test.patientName ?? "Paciente sin nombre"}
                      </p>
                      <p className="truncate text-xs text-foreground-500">
                        {test.patientRut ?? "Sin RUT"} · {test.panelTitle ?? "Sin panel"}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Chip size="sm" variant="soft">
                        {test.examType}
                      </Chip>
                      <span className="text-xs text-foreground-500">
                        {formatNumber(test.resultCount)}
                      </span>
                    </div>
                    {test.oneDriveWebUrl ? (
                      <Tooltip>
                        <Tooltip.Trigger aria-label="Abrir archivo origen">
                          <Button
                            aria-label="Abrir archivo origen"
                            size="sm"
                            variant="ghost"
                            onPress={() => window.open(test.oneDriveWebUrl!, "_blank", "noopener")}
                          >
                            <ExternalLink size={14} />
                          </Button>
                        </Tooltip.Trigger>
                        <Tooltip.Content>Abrir archivo origen</Tooltip.Content>
                      </Tooltip>
                    ) : null}
                  </div>
                ))}
              </Card.Content>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

function SkinTestAnalyticsFilters({
  dateFrom,
  dateTo,
  examType,
  query,
  setDateFrom,
  setDateTo,
  setExamType,
  setQuery,
}: {
  dateFrom: string;
  dateTo: string;
  examType: string;
  query: string;
  setDateFrom: (value: string) => void;
  setDateTo: (value: string) => void;
  setExamType: (value: string) => void;
  setQuery: (value: string) => void;
}) {
  return (
    <Surface className="rounded-xl p-4">
      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_220px_180px_180px]">
        <TextField value={query} onChange={setQuery}>
          <Label>Buscar</Label>
          <Input placeholder="Paciente, RUT, panel o archivo" />
        </TextField>
        <Select
          value={examType as Key}
          onChange={(key) => setExamType(String(key ?? "__ALL__"))}
          placeholder="Todos"
          variant="secondary"
        >
          <Label>Tipo de examen</Label>
          <Select.Trigger>
            <Select.Value />
            <Select.Indicator />
          </Select.Trigger>
          <Select.Popover>
            <ListBox>
              {EXAM_TYPE_OPTIONS.map((item) => (
                <ListBox.Item key={item.value} id={item.value} textValue={item.label}>
                  {item.label}
                  <ListBox.ItemIndicator />
                </ListBox.Item>
              ))}
            </ListBox>
          </Select.Popover>
        </Select>
        <TextField value={dateFrom} onChange={setDateFrom}>
          <Label>Desde</Label>
          <Input type="date" />
        </TextField>
        <TextField value={dateTo} onChange={setDateTo}>
          <Label>Hasta</Label>
          <Input type="date" />
        </TextField>
      </div>
    </Surface>
  );
}

function MetricCard({ label, suffix, value }: { label: string; suffix?: string; value: number }) {
  return (
    <Card className="border-default-200 shadow-sm">
      <Card.Content className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-foreground-400">
              {label}
            </p>
            <p className="mt-2 text-3xl font-semibold text-foreground">{formatNumber(value)}</p>
          </div>
          {suffix ? (
            <Chip color="success" size="sm" variant="soft">
              {suffix}
            </Chip>
          ) : null}
        </div>
      </Card.Content>
    </Card>
  );
}

function DistributionRow({ label, total, value }: { label: string; total: number; value: number }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-3">
        <span className="truncate text-sm font-medium text-foreground">{label}</span>
        <span className="text-xs tabular-nums text-foreground-500">{formatNumber(total)}</span>
      </div>
      <ProgressBar aria-label={`Distribución ${label}`} value={value}>
        <ProgressBar.Track>
          <ProgressBar.Fill />
        </ProgressBar.Track>
      </ProgressBar>
    </div>
  );
}
