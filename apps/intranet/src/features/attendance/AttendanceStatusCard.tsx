import { Card, Chip } from "@heroui/react";
import type {
  attendanceMarkSchema,
  attendanceStatusResponseSchema,
} from "@finanzas/orpc-contracts/attendance";
import dayjs from "dayjs";
import timezone from "dayjs/plugin/timezone";
import utc from "dayjs/plugin/utc";
import type { z } from "zod";

dayjs.extend(utc);
dayjs.extend(timezone);

const TIMEZONE = "America/Santiago";

type AttendanceMark = z.infer<typeof attendanceMarkSchema>;
type AttendanceStatus = z.infer<typeof attendanceStatusResponseSchema>["currentStatus"];

interface AttendanceStatusCardProps {
  currentStatus: AttendanceStatus;
  isOfficeNetwork: boolean;
  lastMark: AttendanceMark | null;
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

export function AttendanceStatusCard({
  currentStatus,
  isOfficeNetwork,
  lastMark,
}: AttendanceStatusCardProps) {
  return (
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

      <Chip color={isOfficeNetwork ? "success" : "warning"} size="sm" variant="secondary">
        Red: {isOfficeNetwork ? "Oficina" : "Externa"}
      </Chip>
    </Card>
  );
}
