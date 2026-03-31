import { Skeleton } from "@heroui/react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Suspense, useState } from "react";
import type { attendanceMarkSchema } from "@finanzas/orpc-contracts/attendance";
import type { z } from "zod";
import { AttendanceStatusCard } from "./AttendanceStatusCard";
import { MarkButton } from "./MarkButton";
import { TodayMarksList } from "./TodayMarksList";
import { attendanceQueries } from "./queries";
type AttendanceMark = z.infer<typeof attendanceMarkSchema>;

function MarcarContent() {
  const { data, refetch } = useSuspenseQuery(attendanceQueries.status());
  const [todayMarks, setTodayMarks] = useState<AttendanceMark[]>(data.todayMarks);
  const [currentStatus, setCurrentStatus] = useState(data.currentStatus);
  const [lastMark, setLastMark] = useState(data.lastMark);

  function handleMarkSuccess(mark: AttendanceMark) {
    setTodayMarks((prev) => [...prev, mark]);
    setLastMark(mark);
    setCurrentStatus(mark.type === "CLOCK_IN" ? "CLOCKED_IN" : "CLOCKED_OUT");
    void refetch();
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.95fr)] lg:gap-6">
      <div className="order-1 min-w-0 lg:order-2">
        <MarkButton currentStatus={currentStatus} onSuccess={handleMarkSuccess} />
      </div>

      <div className="order-2 min-w-0 lg:order-1">
        <AttendanceStatusCard
          clockedInAt={data.clockedInAt}
          currentStatus={currentStatus}
          hasIncompleteYesterday={data.hasIncompleteYesterday}
          lastMark={lastMark}
          monthStats={data.monthStats}
          weekSummary={data.weekSummary}
        />
      </div>

      <div className="order-3 min-w-0 lg:col-start-2">
        <TodayMarksList marks={todayMarks} />
      </div>
    </div>
  );
}

export function MarcarPage() {
  return (
    <div className="flex w-full flex-col gap-5 px-2 pt-16 pb-4 md:px-3 md:pt-4 md:pb-4">
      <Suspense
        fallback={
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1.7fr)_360px]">
            <div className="flex flex-col gap-6">
              <Skeleton className="h-44 w-full rounded-3xl" />
              <Skeleton className="h-64 w-full rounded-3xl" />
              <Skeleton className="h-72 w-full rounded-3xl" />
            </div>
            <div className="flex flex-col gap-6">
              <Skeleton className="h-48 w-full rounded-3xl" />
            </div>
          </div>
        }
      >
        <MarcarContent />
      </Suspense>
    </div>
  );
}
