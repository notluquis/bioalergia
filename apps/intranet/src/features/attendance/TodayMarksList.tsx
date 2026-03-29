import { Card, Chip } from "@heroui/react";
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
    return <p className="text-sm text-foreground-400">No hay registros de hoy.</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      {marks.map((mark) => (
        <Card key={mark.id} className="flex flex-row items-center justify-between px-4 py-2.5">
          <div className="flex items-center gap-2">
            <Chip color={mark.type === "CLOCK_IN" ? "success" : "danger"} size="sm" variant="soft">
              {mark.type === "CLOCK_IN" ? "Entrada" : "Salida"}
            </Chip>
            <span className="text-sm font-medium">
              {dayjs(mark.markedAt).tz(TIMEZONE).format("HH:mm")}
            </span>
          </div>

          <div className="flex items-center gap-3">
            {mark.isOfficeNetwork && (
              <Chip color="success" size="sm" variant="secondary">
                Oficina
              </Chip>
            )}
            {mark.latitude !== null && mark.longitude !== null && (
              <a
                className="text-xs text-accent hover:underline"
                href={`https://www.google.com/maps?q=${mark.latitude},${mark.longitude}`}
                rel="noopener noreferrer"
                target="_blank"
              >
                GPS
              </a>
            )}
          </div>
        </Card>
      ))}
    </div>
  );
}
