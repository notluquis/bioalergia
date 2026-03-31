import { Card, Chip, Skeleton } from "@heroui/react";
import { useSuspenseQuery } from "@tanstack/react-query";
import dayjs from "dayjs";
import timezone from "dayjs/plugin/timezone";
import utc from "dayjs/plugin/utc";
import { Suspense, useState } from "react";
import type { attendanceMarkSchema } from "@finanzas/orpc-contracts/attendance";
import type { z } from "zod";
import { AttendanceStatusCard } from "./AttendanceStatusCard";
import { MarkButton } from "./MarkButton";
import { TodayMarksList } from "./TodayMarksList";
import { attendanceQueries } from "./queries";

dayjs.extend(utc);
dayjs.extend(timezone);

const TIMEZONE = "America/Santiago";
type AttendanceMark = z.infer<typeof attendanceMarkSchema>;

function MarcarContent() {
  const { data, refetch } = useSuspenseQuery(attendanceQueries.status());
  const [todayMarks, setTodayMarks] = useState<AttendanceMark[]>(data.todayMarks);
  const [currentStatus, setCurrentStatus] = useState(data.currentStatus);
  const [lastMark, setLastMark] = useState(data.lastMark);

  const isOfficeNetwork = lastMark?.isOfficeNetwork ?? false;

  function handleMarkSuccess(mark: AttendanceMark) {
    setTodayMarks((prev) => [...prev, mark]);
    setLastMark(mark);
    setCurrentStatus(mark.type === "CLOCK_IN" ? "CLOCKED_IN" : "CLOCKED_OUT");
    void refetch();
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.95fr)]">
      <div className="flex min-w-0 flex-col gap-6">
        <AttendanceStatusCard
          clockedInAt={data.clockedInAt}
          currentStatus={currentStatus}
          hasIncompleteYesterday={data.hasIncompleteYesterday}
          isOfficeNetwork={isOfficeNetwork}
          lastMark={lastMark}
          monthStats={data.monthStats}
          weekSummary={data.weekSummary}
        />
      </div>

      <div className="flex min-w-0 flex-col gap-6">
        <MarkButton currentStatus={currentStatus} onSuccess={handleMarkSuccess} />

        <TodayMarksList marks={todayMarks} />
      </div>
    </div>
  );
}

export function MarcarPage() {
  const currentDate = dayjs().tz(TIMEZONE);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 md:px-6 md:py-8">
      <Card className="overflow-hidden border border-default-200/60 bg-linear-to-br from-content1 via-content1 to-primary/5 shadow-sm">
        <Card.Content className="flex flex-col gap-6 p-6 md:p-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="space-y-3">
              <Chip color="accent" size="sm" variant="soft">
                Asistencia
              </Chip>
              <div className="space-y-2">
                <h1 className="text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
                  Marcaje de asistencia
                </h1>
                <p className="max-w-2xl text-sm leading-6 text-foreground-500 md:text-base">
                  Revisa tu estado actual, marca entrada o salida y valida tus registros del
                  d&iacute;a sin salir de esta vista.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Chip size="sm" variant="secondary">
                {currentDate.format("dddd D [de] MMMM")}
              </Chip>
              <Chip color="default" size="sm" variant="soft">
                {currentDate.format("HH:mm")}
              </Chip>
            </div>
          </div>
        </Card.Content>
      </Card>

      <Suspense
        fallback={
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.95fr)]">
            <div className="flex flex-col gap-6">
              <Skeleton className="h-72 w-full rounded-3xl" />
              <Skeleton className="h-56 w-full rounded-3xl" />
            </div>
            <div className="flex flex-col gap-6">
              <Skeleton className="h-56 w-full rounded-3xl" />
              <Skeleton className="h-80 w-full rounded-3xl" />
            </div>
          </div>
        }
      >
        <MarcarContent />
      </Suspense>
    </div>
  );
}
