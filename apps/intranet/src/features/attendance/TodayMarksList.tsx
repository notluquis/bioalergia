import type { attendanceMarkSchema } from "@finanzas/orpc-contracts/attendance";
import dayjs from "dayjs";
import timezone from "dayjs/plugin/timezone";
import utc from "dayjs/plugin/utc";
import type { z } from "zod";

dayjs.extend(utc);
dayjs.extend(timezone);

const TIMEZONE = "America/Santiago";

type AttendanceMark = z.infer<typeof attendanceMarkSchema>;

interface TodayMarksListProps {
  marks: AttendanceMark[];
}

export function TodayMarksList({ marks }: TodayMarksListProps) {
  if (marks.length === 0) {
    return <p className="text-sm text-gray-400">No hay registros de hoy.</p>;
  }

  return (
    <ul className="flex flex-col gap-2">
      {marks.map((mark) => (
        <li
          key={mark.id}
          className="flex items-center justify-between rounded-lg border border-gray-100 bg-white px-4 py-2.5 text-sm shadow-sm"
        >
          <div className="flex items-center gap-2">
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                mark.type === "CLOCK_IN" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"
              }`}
            >
              {mark.type === "CLOCK_IN" ? "Entrada" : "Salida"}
            </span>
            <span className="font-medium">{dayjs(mark.markedAt).tz(TIMEZONE).format("HH:mm")}</span>
          </div>

          <div className="flex items-center gap-3 text-gray-400">
            {mark.isOfficeNetwork && <span className="text-xs text-green-600">Oficina</span>}
            {mark.latitude !== null && mark.longitude !== null && (
              <a
                href={`https://www.google.com/maps?q=${mark.latitude},${mark.longitude}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-blue-500 hover:underline"
                title="Ver ubicación"
              >
                GPS
              </a>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
