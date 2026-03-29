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
  CLOCKED_IN: "En consulta",
  CLOCKED_OUT: "Fuera de consulta",
  NO_MARKS_TODAY: "Sin registros hoy",
};

const STATUS_COLOR: Record<AttendanceStatus, "default" | "success"> = {
  CLOCKED_IN: "success",
  CLOCKED_OUT: "default",
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

      <Card className="flex flex-col items-center gap-3 p-6 text-center">
        <Chip color={STATUS_COLOR[currentStatus]} size="lg" variant="soft">
          {STATUS_LABEL[currentStatus]}
        </Chip>

        {lastMark && (
          <p className="text-sm text-foreground-500">
            Última marca:{" "}
            <span className="font-medium">
              {dayjs(lastMark.markedAt).tz(TIMEZONE).format("HH:mm")}
            </span>
            {" — "}
            {lastMark.type === "CLOCK_IN" ? "Entrada" : "Salida"}
          </p>
        )}

        {currentStatus === "CLOCKED_IN" && clockedInAt && (
          <div className="flex items-center gap-1.5 text-sm text-foreground-500">
            <span>Tiempo trabajado:</span>
            <LiveTimer clockedInAt={clockedInAt} />
          </div>
        )}

        <Chip color={isOfficeNetwork ? "success" : "warning"} size="sm" variant="secondary">
          Red: {isOfficeNetwork ? "Oficina" : "Externa"}
        </Chip>
      </Card>

      {/* Semana */}
      {weekSummary.length > 0 && (
        <Card className="p-4">
          <p className="mb-3 text-xs font-medium uppercase tracking-wide text-foreground-400">
            Esta semana
          </p>
          <div className="flex justify-between gap-1">
            {weekSummary.map((day, i) => {
              const label = WEEK_DAY_LABELS[i] ?? "";
              const tooltipContent =
                day.workedMinutes !== null
                  ? `${dayjs(day.date).format("DD/MM")} · ${formatMinutes(day.workedMinutes)}`
                  : `${dayjs(day.date).format("DD/MM")} · ${day.status === "absent" ? "Sin registro" : day.status === "incomplete" ? "Incompleto" : ""}`;

              return (
                <Tooltip key={day.date}>
                  <Tooltip.Trigger>
                    <div className="flex flex-1 flex-col items-center gap-1">
                      <span className="text-[10px] text-foreground-400">{label}</span>
                      <div
                        className={`flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-bold ${WEEK_STATUS_COLOR[day.status]}`}
                      >
                        {day.status === "worked" || day.status === "today"
                          ? day.workedMinutes !== null
                            ? `${Math.floor(day.workedMinutes / 60)}h`
                            : "·"
                          : day.status === "incomplete"
                            ? "!"
                            : "·"}
                      </div>
                    </div>
                  </Tooltip.Trigger>
                  <Tooltip.Content>{tooltipContent}</Tooltip.Content>
                </Tooltip>
              );
            })}
          </div>
        </Card>
      )}

      {/* Mes */}
      {(monthStats.daysWorked > 0 || currentStatus !== "NO_MARKS_TODAY") && (
        <Card className="flex flex-row items-center justify-between px-4 py-3">
          <p className="text-xs font-medium uppercase tracking-wide text-foreground-400">
            Este mes
          </p>
          <div className="flex items-center gap-3 text-sm">
            <span className="font-semibold">{monthStats.daysWorked} días</span>
            {monthStats.totalMinutes > 0 && (
              <span className="text-foreground-500">{formatMinutes(monthStats.totalMinutes)}</span>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}
