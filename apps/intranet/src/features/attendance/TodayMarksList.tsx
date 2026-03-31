import { Card, Chip, Link } from "@heroui/react";
import type { attendanceMarkSchema } from "@finanzas/orpc-contracts/attendance";
import dayjs from "dayjs";
import timezone from "dayjs/plugin/timezone";
import utc from "dayjs/plugin/utc";
import type { z } from "zod";
import { getAttendanceNetworkOrigin } from "./network-origin";

dayjs.extend(utc);
dayjs.extend(timezone);

const TIMEZONE = "America/Santiago";

type AttendanceMark = z.infer<typeof attendanceMarkSchema>;

interface TodayMarksListProps {
  marks: AttendanceMark[];
}

export function TodayMarksList({ marks }: TodayMarksListProps) {
  return (
    <Card className="rounded-3xl shadow-sm" variant="default">
      <Card.Header className="flex flex-col items-start gap-1 p-5 pb-3">
        <Card.Title className="text-base">Registros de hoy</Card.Title>
        <Card.Description>Hora, tipo de marca y contexto de red.</Card.Description>
      </Card.Header>

      <Card.Content className="flex flex-col gap-3 p-5 pt-0">
        {marks.length === 0 ? (
          <Card
            className="rounded-2xl border border-dashed border-default-200/70 shadow-none"
            variant="transparent"
          >
            <Card.Content className="px-4 py-8 text-center">
              <p className="text-sm font-medium text-foreground">No hay registros de hoy.</p>
              <p className="mt-1 text-sm text-foreground-500">
                Tu primera marca aparecera aqui apenas la registres.
              </p>
            </Card.Content>
          </Card>
        ) : (
          marks.map((mark) => {
            const networkOrigin = getAttendanceNetworkOrigin(mark);
            return (
              <Card key={mark.id} className="rounded-2xl shadow-none" variant="secondary">
                <Card.Content className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-3">
                    <Chip
                      color={mark.type === "CLOCK_IN" ? "success" : "danger"}
                      size="sm"
                      variant="soft"
                    >
                      {mark.type === "CLOCK_IN" ? "Entrada" : "Salida"}
                    </Chip>
                    <div>
                      <p className="text-base font-semibold text-foreground">
                        {dayjs(mark.markedAt).tz(TIMEZONE).format("HH:mm")}
                      </p>
                      <p className="text-sm text-foreground-500">
                        {dayjs(mark.markedAt).tz(TIMEZONE).format("dddd D [de] MMMM")}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <Chip color={networkOrigin.tone} size="sm" variant="secondary">
                      {networkOrigin.label}
                    </Chip>
                    {mark.latitude !== null && mark.longitude !== null && (
                      <Link
                        className="text-sm"
                        href={`https://www.google.com/maps?q=${mark.latitude},${mark.longitude}`}
                        rel="noopener noreferrer"
                        target="_blank"
                      >
                        Ver GPS
                      </Link>
                    )}
                  </div>
                </Card.Content>
              </Card>
            );
          })
        )}
      </Card.Content>
    </Card>
  );
}
