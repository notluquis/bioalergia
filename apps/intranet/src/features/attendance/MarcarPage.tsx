import { Chip, Skeleton, Surface } from "@heroui/react";
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
    <div className="flex w-full flex-col gap-5 px-2 py-3 md:px-3 md:py-4">
      <Surface
        className="flex flex-col gap-4 rounded-3xl border border-default-200/60 px-5 py-5 md:flex-row md:items-end md:justify-between md:px-6"
        variant="secondary"
      >
        <div className="space-y-3">
          <Chip color="accent" size="sm" variant="soft">
            Asistencia
          </Chip>
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
              Marcaje de asistencia
            </h1>
            <p className="max-w-2xl text-sm leading-6 text-foreground-500">
              Estado, accion principal y registro del dia en una sola vista.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Chip color="default" size="sm" variant="secondary">
            {currentDate.format("dddd D [de] MMMM")}
          </Chip>
          <Chip color="accent" size="sm" variant="soft">
            {currentDate.format("HH:mm")}
          </Chip>
        </div>
      </Surface>

      <Suspense
        fallback={
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1.7fr)_360px]">
            <div className="flex flex-col gap-6">
              <Skeleton className="h-64 w-full rounded-3xl" />
              <Skeleton className="h-48 w-full rounded-3xl" />
            </div>
            <div className="flex flex-col gap-6">
              <Skeleton className="h-44 w-full rounded-3xl" />
              <Skeleton className="h-72 w-full rounded-3xl" />
            </div>
          </div>
        }
      >
        <MarcarContent />
      </Suspense>
    </div>
  );
}
