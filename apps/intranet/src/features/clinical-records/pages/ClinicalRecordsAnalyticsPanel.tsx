import { Card, ProgressBar, Skeleton, Surface } from "@heroui/react";
import { Activity, FileCheck2, FileClock, Users } from "lucide-react";
import { useMemo, useState } from "react";
import { AppDateRangePicker } from "@/components/forms/AppDatePicker";
import { useClinicalRecordAnalytics } from "../hooks/useClinicalRecords";

const fmt = (n: number) => n.toLocaleString("es-CL");

function formatMonth(month: string) {
  const [year, m] = month.split("-");
  if (!year || !m) return month;
  return new Intl.DateTimeFormat("es-CL", { month: "short", year: "numeric" }).format(
    new Date(Number(year), Number(m) - 1, 1)
  );
}

function MetricCard({
  icon,
  label,
  value,
  suffix,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  suffix?: string;
}) {
  return (
    <Card className="border-default-200 shadow-sm">
      <Card.Content className="p-4">
        <div className="flex items-center gap-2 text-default-500">
          {icon}
          <p className="font-medium text-xs uppercase tracking-wider">{label}</p>
        </div>
        <p className="mt-2 font-semibold text-2xl">
          {value}
          {suffix && <span className="ml-1 text-default-400 text-sm">{suffix}</span>}
        </p>
      </Card.Content>
    </Card>
  );
}

function BarRow({ label, count, max }: { label: string; count: number; max: number }) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-40 shrink-0 truncate text-sm" title={label}>
        {label}
      </span>
      <ProgressBar aria-label={label} value={max > 0 ? (count / max) * 100 : 0} className="flex-1">
        <ProgressBar.Track>
          <ProgressBar.Fill />
        </ProgressBar.Track>
      </ProgressBar>
      <span className="w-12 shrink-0 text-right text-default-500 text-sm tabular-nums">
        {fmt(count)}
      </span>
    </div>
  );
}

export function ClinicalRecordsAnalyticsPanel() {
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const filters = useMemo(
    () => ({ dateFrom: dateFrom || undefined, dateTo: dateTo || undefined }),
    [dateFrom, dateTo]
  );
  const { data, isLoading } = useClinicalRecordAnalytics(filters);

  const maxMonth = Math.max(1, ...(data?.byMonth.map((r) => r.count) ?? [0]));
  const maxDx = Math.max(1, ...(data?.topDiagnoses.map((r) => r.count) ?? [0]));
  const maxPatient = Math.max(1, ...(data?.topPatients.map((r) => r.count) ?? [0]));

  return (
    <div className="flex flex-col gap-4">
      <Surface className="p-3">
        <AppDateRangePicker
          className="w-72"
          label="Rango de fechas (consulta)"
          startValue={dateFrom}
          endValue={dateTo}
          visibleMonths={2}
          onChange={(from, to) => {
            setDateFrom(from);
            setDateTo(to);
          }}
        />
      </Surface>

      {isLoading || !data ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <MetricCard
              icon={<FileCheck2 size={16} />}
              label="Importadas"
              value={fmt(data.totals.imported)}
            />
            <MetricCard
              icon={<FileClock size={16} />}
              label="Pendientes"
              value={fmt(data.totals.pending)}
            />
            <MetricCard
              icon={<Activity size={16} />}
              label="Sin procesar"
              value={fmt(data.totals.discovered)}
            />
            <MetricCard
              icon={<Users size={16} />}
              label="Tasa de match"
              value={`${Math.round(data.matchRate * 100)}`}
              suffix="%"
            />
          </div>

          <Card className="p-4">
            <h3 className="mb-3 font-semibold text-sm">Fichas por mes de consulta</h3>
            {data.byMonth.length === 0 ? (
              <p className="text-default-400 text-sm">Sin datos en el rango.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {data.byMonth.map((r) => (
                  <BarRow
                    key={r.month}
                    label={formatMonth(r.month)}
                    count={r.count}
                    max={maxMonth}
                  />
                ))}
              </div>
            )}
          </Card>

          <div className="grid gap-4 md:grid-cols-2">
            <Card className="p-4">
              <h3 className="mb-3 font-semibold text-sm">Diagnósticos más frecuentes</h3>
              {data.topDiagnoses.length === 0 ? (
                <p className="text-default-400 text-sm">Sin datos.</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {data.topDiagnoses.map((r) => (
                    <BarRow key={r.label} label={r.label} count={r.count} max={maxDx} />
                  ))}
                </div>
              )}
            </Card>

            <Card className="p-4">
              <h3 className="mb-3 font-semibold text-sm">Pacientes con más fichas</h3>
              {data.topPatients.length === 0 ? (
                <p className="text-default-400 text-sm">Sin datos.</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {data.topPatients.map((r) => (
                    <BarRow
                      key={r.patientName}
                      label={r.patientName}
                      count={r.count}
                      max={maxPatient}
                    />
                  ))}
                </div>
              )}
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
