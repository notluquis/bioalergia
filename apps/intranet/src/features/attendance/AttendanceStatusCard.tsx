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
  lastMark: AttendanceMark | null;
  isOfficeNetwork: boolean;
}

const STATUS_LABEL: Record<AttendanceStatus, string> = {
  CLOCKED_IN: "En consulta",
  CLOCKED_OUT: "Fuera de consulta",
  NO_MARKS_TODAY: "Sin registros hoy",
};

const STATUS_COLOR: Record<AttendanceStatus, string> = {
  CLOCKED_IN: "bg-green-100 text-green-800 border-green-200",
  CLOCKED_OUT: "bg-gray-100 text-gray-700 border-gray-200",
  NO_MARKS_TODAY: "bg-gray-100 text-gray-500 border-gray-200",
};

export function AttendanceStatusCard({
  currentStatus,
  lastMark,
  isOfficeNetwork,
}: AttendanceStatusCardProps) {
  return (
    <div className="flex flex-col gap-3">
      <div className={`rounded-2xl border px-6 py-5 text-center ${STATUS_COLOR[currentStatus]}`}>
        <p className="text-2xl font-semibold">{STATUS_LABEL[currentStatus]}</p>
        {lastMark && (
          <p className="mt-1 text-sm opacity-70">
            Última marca:{" "}
            <span className="font-medium">
              {dayjs(lastMark.markedAt).tz(TIMEZONE).format("HH:mm")}
            </span>
            {" — "}
            {lastMark.type === "CLOCK_IN" ? "Entrada" : "Salida"}
          </p>
        )}
      </div>

      <div className="flex items-center gap-4 text-sm text-gray-500">
        <span className="flex items-center gap-1.5">
          <span
            className={`inline-block h-2 w-2 rounded-full ${isOfficeNetwork ? "bg-green-500" : "bg-yellow-400"}`}
          />
          Red: {isOfficeNetwork ? "Oficina" : "Externa"}
        </span>
      </div>
    </div>
  );
}
