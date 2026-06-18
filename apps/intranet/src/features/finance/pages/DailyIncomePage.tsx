import { Alert, Card, Chip, Skeleton } from "@heroui/react";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { AppDateRangePicker } from "@/components/forms/AppDatePicker";
import { chileDay, diffDays, endOfMonth, formatChile, startOfMonth } from "@/lib/dates";
import { fetchCalendarDaily } from "@/features/calendar/api";

type EventForDaily = {
  amountExpected: null | number;
  amountPaid: null | number;
  eventType: null | string;
  id: string;
  startDate: string;
  summary: null | string;
};

export function DailyIncomePage() {
  const [from, setFrom] = useState(startOfMonth());
  const [to, setTo] = useState(endOfMonth());

  const { data, isLoading } = useQuery({
    queryFn: () =>
      fetchCalendarDaily({
        categories: [],
        from,
        maxDays: Math.max(diffDays(to, from) + 1, 1),
        to,
      }),
    queryKey: ["daily-income", from, to],
  });
  const events: EventForDaily[] =
    data?.days.flatMap((day) =>
      day.events.map((event) => ({
        amountExpected: event.amountExpected ?? null,
        amountPaid: event.amountPaid ?? null,
        eventType: event.eventType,
        id: event.eventId,
        startDate: event.startDate ?? event.eventDate,
        summary: event.summary,
      }))
    ) ?? [];

  // Group by date
  const grouped = (events || []).reduce(
    (acc, event) => {
      const date = event.startDate ? chileDay(event.startDate) : "Sin fecha";
      if (!acc[date]) {
        acc[date] = [];
      }
      acc[date].push(event);
      return acc;
    },
    {} as Record<string, EventForDaily[]>
  );

  const sortedDates = Object.keys(grouped).sort((a, b) => b.localeCompare(a));

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <AppDateRangePicker
          aria-label="Rango de fechas"
          className="w-full max-w-sm"
          visibleMonths={2}
          startValue={from}
          endValue={to}
          onChange={(start, end) => {
            if (!start || !end) {
              return;
            }
            setFrom(start);
            setTo(end);
          }}
        />
      </div>

      <div className="space-y-4">
        {isLoading && (
          <div className="space-y-3 py-2">
            {["1", "2", "3"].map((skeletonKey) => (
              <Card key={`daily-income-skeleton-${skeletonKey}`} className="w-full">
                <Card.Content className="gap-3 p-4">
                  <div className="flex items-center justify-between">
                    <Skeleton className="h-5 w-52 rounded-md" />
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-28 rounded-md" />
                      <Skeleton className="h-4 w-24 rounded-md" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    {["line-1", "line-2", "line-3"].map((lineKey) => (
                      <div className="flex items-center justify-between" key={lineKey}>
                        <Skeleton className="h-4 w-56 rounded-md" />
                        <Skeleton className="h-4 w-20 rounded-md" />
                      </div>
                    ))}
                  </div>
                </Card.Content>
              </Card>
            ))}
          </div>
        )}

        {!isLoading && sortedDates.length === 0 && (
          <Alert status="warning">
            <Alert.Content>
              <Alert.Description>No se encontraron eventos para este periodo.</Alert.Description>
            </Alert.Content>
          </Alert>
        )}

        {sortedDates.map((date) => {
          const dayEvents = grouped[date] ?? [];
          const totalExpected = dayEvents.reduce(
            (sum: number, e: EventForDaily) => sum + (e.amountExpected || 0),
            0
          );
          const totalPaid = dayEvents.reduce(
            (sum: number, e: EventForDaily) => sum + (e.amountPaid || 0),
            0
          );

          return (
            <Card key={date} className="w-full">
              <Card.Content className="gap-4 p-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-lg capitalize">
                    {formatChile(date, "dddd D [de] MMMM")}
                  </h3>
                  <div className="text-right text-sm">
                    <div className="text-default-600">
                      Esperado: ${totalExpected.toLocaleString()}
                    </div>
                    <div className="font-bold text-success">
                      Pagado: ${totalPaid.toLocaleString()}
                    </div>
                  </div>
                </div>
                <div className="divider my-0" />
                <ul className="space-y-2">
                  {dayEvents.map((event: EventForDaily) => (
                    <li key={event.id} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <span>{event.summary || "Evento sin título"}</span>
                        <Chip size="sm" variant="soft" className="h-5 text-xs">
                          {event.eventType}
                        </Chip>
                      </div>
                      <span
                        className={
                          event.amountPaid ? "font-medium text-success" : "text-default-400"
                        }
                      >
                        ${(event.amountPaid || 0).toLocaleString()}
                      </span>
                    </li>
                  ))}
                </ul>
              </Card.Content>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
