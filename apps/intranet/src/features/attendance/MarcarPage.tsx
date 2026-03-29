import { Skeleton } from "@heroui/react";
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
    <div className="flex flex-col gap-6">
      <AttendanceStatusCard
        clockedInAt={data.clockedInAt}
        currentStatus={currentStatus}
        hasIncompleteYesterday={data.hasIncompleteYesterday}
        isOfficeNetwork={isOfficeNetwork}
        lastMark={lastMark}
        monthStats={data.monthStats}
        weekSummary={data.weekSummary}
      />

      <MarkButton currentStatus={currentStatus} onSuccess={handleMarkSuccess} />

      <section>
        <h2 className="mb-3 text-sm font-medium text-foreground-500 uppercase tracking-wide">
          Registros de hoy — {dayjs().tz(TIMEZONE).format("dddd D [de] MMMM")}
        </h2>
        <TodayMarksList marks={todayMarks} />
      </section>
    </div>
  );
}

export function MarcarPage() {
  return (
    <div className="mx-auto max-w-sm px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold">Marcaje de Asistencia</h1>
      <Suspense
        fallback={
          <div className="flex flex-col gap-4">
            <Skeleton className="h-36 w-full rounded-2xl" />
            <Skeleton className="h-24 w-full rounded-xl" />
            <Skeleton className="h-12 w-full rounded-xl" />
          </div>
        }
      >
        <MarcarContent />
      </Suspense>
    </div>
  );
}
