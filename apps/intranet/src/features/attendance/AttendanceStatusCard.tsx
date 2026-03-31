import { Alert, Card, Chip, Tooltip } from "@heroui/react";
import type {
  attendanceMarkSchema,
  attendanceStatusResponseSchema,
  weekDaySummarySchema,
} from "@finanzas/orpc-contracts/attendance";
import dayjs from "dayjs";
import timezone from "dayjs/plugin/timezone";
import utc from "dayjs/plugin/utc";
import { useEffect, useState } from "react";
import type { z } from "zod";

dayjs.extend(utc);
dayjs.extend(timezone);

const TIMEZONE = "America/Santiago";

type AttendanceMark = z.infer<typeof attendanceMarkSchema>;
type AttendanceStatus = z.infer<typeof attendanceStatusResponseSchema>["currentStatus"];
type WeekDaySummary = z.infer<typeof weekDaySummarySchema>;

interface AttendanceStatusCardProps {
  clockedInAt: Date | null;
  currentStatus: AttendanceStatus;
  hasIncompleteYesterday: boolean;
  isOfficeNetwork: boolean;
  lastMark: AttendanceMark | null;
  monthStats: { daysWorked: number; totalMinutes: number };
  weekSummary: WeekDaySummary[];
}

const STATUS_LABEL: Record<AttendanceStatus, string> = {
  CLOCKED_IN: "Jornada activa",
  CLOCKED_OUT: "Jornada cerrada",
  NO_MARKS_TODAY: "Sin registros hoy",
};

const STATUS_COLOR: Record<AttendanceStatus, "accent" | "default" | "success"> = {
  CLOCKED_IN: "success",
  CLOCKED_OUT: "accent",
  NO_MARKS_TODAY: "default",
};

const WEEK_DAY_LABELS = ["Lu", "Ma", "Mi", "Ju", "Vi", "Sá", "Do"];

const WEEK_STATUS_COLOR: Record<WeekDaySummary["status"], string> = {
  worked: "bg-success text-success-foreground",
  today: "bg-accent text-accent-foreground ring-2 ring-accent/40",
  incomplete: "bg-warning text-warning-foreground",
  absent: "bg-default-100 text-default-400",
};

function formatMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function LiveTimer({ clockedInAt }: { clockedInAt: Date }) {
  const [minutes, setMinutes] = useState(() =>
    Math.floor((Date.now() - new Date(clockedInAt).getTime()) / 60_000)
  );

  useEffect(() => {
    const interval = setInterval(() => {
      setMinutes(Math.floor((Date.now() - new Date(clockedInAt).getTime()) / 60_000));
    }, 60_000);
    return () => clearInterval(interval);
  }, [clockedInAt]);

  return (
    <span className="text-sm font-semibold tabular-nums text-success">
      {formatMinutes(minutes)}
    </span>
  );
}

export function AttendanceStatusCard({
  clockedInAt,
  currentStatus,
  hasIncompleteYesterday,
  isOfficeNetwork,
  lastMark,
  monthStats,
  weekSummary,
}: AttendanceStatusCardProps) {
  return (
    <div className="flex flex-col gap-3">
      {hasIncompleteYesterday && (
        <Alert status="warning">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Description>
              Ayer no registraste salida. Contacta a tu administrador si necesitas una corrección.
            </Alert.Description>
          </Alert.Content>
        </Alert>
      )}

      <Card className="overflow-hidden border border-default-200/60 bg-linear-to-br from-content1 via-content1 to-content2 shadow-sm">
        <Card.Header className="flex flex-col items-start gap-4 border-b border-default-100/80 p-6 md:p-7">
          <div className="flex w-full flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div className="space-y-3">
              <Chip color={STATUS_COLOR[currentStatus]} size="lg" variant="soft">
                {STATUS_LABEL[currentStatus]}
              </Chip>
              <div className="space-y-1">
                <Card.Title className="text-2xl md:text-3xl">
                  {currentStatus === "CLOCKED_IN"
                    ? "Tu jornada est&aacute; en curso"
                    : currentStatus === "CLOCKED_OUT"
                      ? "Tu &uacute;ltima marca fue una salida"
                      : "Todav&iacute;a no registras actividad hoy"}
                </Card.Title>
                <Card.Description className="max-w-2xl text-sm leading-6 md:text-base">
                  {lastMark
                    ? `Última marca a las ${dayjs(lastMark.markedAt).tz(TIMEZONE).format("HH:mm")} como ${
                        lastMark.type === "CLOCK_IN" ? "entrada" : "salida"
                      }.`
                    : "Cuando registres tu primera marca del día, aparecerá aquí junto con el resumen de tiempo."}
                </Card.Description>
              </div>
            </div>

            <Chip color={isOfficeNetwork ? "success" : "warning"} size="sm" variant="soft">
              {isOfficeNetwork ? "Red de oficina" : "Red externa"}
            </Chip>
          </div>
        </Card.Header>

        <Card.Content className="grid gap-4 p-6 md:grid-cols-3 md:p-7">
          <div className="rounded-2xl border border-default-200/70 bg-content1 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-foreground-400">
              Estado actual
            </p>
            <p className="mt-3 text-lg font-semibold text-foreground">
              {STATUS_LABEL[currentStatus]}
            </p>
          </div>

          <div className="rounded-2xl border border-default-200/70 bg-content1 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-foreground-400">
              Tiempo acumulado
            </p>
            <div className="mt-3 text-lg font-semibold text-foreground">
              {currentStatus === "CLOCKED_IN" && clockedInAt ? (
                <LiveTimer clockedInAt={clockedInAt} />
              ) : monthStats.totalMinutes > 0 ? (
                formatMinutes(monthStats.totalMinutes)
              ) : (
                "Sin horas hoy"
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-default-200/70 bg-content1 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-foreground-400">
              Días trabajados
            </p>
            <p className="mt-3 text-lg font-semibold text-foreground">
              {monthStats.daysWorked} d&iacute;as
            </p>
          </div>
        </Card.Content>
      </Card>

      {weekSummary.length > 0 && (
        <Card className="border border-default-200/60 shadow-sm">
          <Card.Header className="flex items-center justify-between gap-4 p-5 pb-2">
            <div>
              <Card.Title className="text-base">Semana actual</Card.Title>
              <Card.Description>
                Sigue el ritmo de asistencia y detecta d&iacute;as incompletos de inmediato.
              </Card.Description>
            </div>
          </Card.Header>
          <Card.Content className="grid grid-cols-2 gap-3 p-5 pt-3 sm:grid-cols-4 xl:grid-cols-7">
            {weekSummary.map((day, i) => {
              const label = WEEK_DAY_LABELS[i] ?? "";
              const tooltipContent =
                day.workedMinutes !== null
                  ? `${dayjs(day.date).format("DD/MM")} · ${formatMinutes(day.workedMinutes)}`
                  : `${dayjs(day.date).format("DD/MM")} · ${day.status === "absent" ? "Sin registro" : day.status === "incomplete" ? "Incompleto" : ""}`;

              return (
                <Tooltip key={day.date}>
                  <Tooltip.Trigger>
                    <div className="flex min-h-24 flex-col justify-between rounded-2xl border border-default-200/70 bg-content1 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-medium text-foreground-500">{label}</span>
                        <div
                          className={`flex h-8 min-w-8 items-center justify-center rounded-full px-2 text-[10px] font-bold ${WEEK_STATUS_COLOR[day.status]}`}
                        >
                          {day.status === "worked" || day.status === "today"
                            ? day.workedMinutes !== null
                              ? `${Math.max(1, Math.floor(day.workedMinutes / 60))}h`
                              : "Hoy"
                            : day.status === "incomplete"
                              ? "!"
                              : "·"}
                        </div>
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs text-foreground-400">
                          {dayjs(day.date).format("DD/MM")}
                        </p>
                        <p className="text-sm font-medium text-foreground">
                          {day.workedMinutes !== null
                            ? formatMinutes(day.workedMinutes)
                            : "Sin marca"}
                        </p>
                      </div>
                    </div>
                  </Tooltip.Trigger>
                  <Tooltip.Content>{tooltipContent}</Tooltip.Content>
                </Tooltip>
              );
            })}
          </Card.Content>
        </Card>
      )}

      {(monthStats.daysWorked > 0 || currentStatus !== "NO_MARKS_TODAY") && (
        <Card className="border border-default-200/60 shadow-sm">
          <Card.Content className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-foreground-400">
                Resumen mensual
              </p>
              <p className="mt-1 text-sm text-foreground-500">
                Consolidado r&aacute;pido para validar continuidad y carga horaria.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Chip color="accent" variant="soft">
                {monthStats.daysWorked} d&iacute;as trabajados
              </Chip>
              {monthStats.totalMinutes > 0 && (
                <Chip variant="secondary">{formatMinutes(monthStats.totalMinutes)}</Chip>
              )}
            </div>
          </Card.Content>
        </Card>
      )}
    </div>
  );
}
