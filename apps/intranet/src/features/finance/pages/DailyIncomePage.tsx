import type { Event } from "@finanzas/db/models";
import { schema as schemaLite } from "@finanzas/db/schema-lite";
import { Alert, Card, Chip, Input, Skeleton } from "@heroui/react";
import { useClientQueries } from "@zenstackhq/tanstack-query/react";
import dayjs from "dayjs";
import { useState } from "react";

type EventForDaily = Pick<
  Event,
  "id" | "startDate" | "summary" | "eventType" | "amountExpected" | "amountPaid"
>;

export function DailyIncomePage() {
  const [from, setFrom] = useState(dayjs().startOf("month").format("YYYY-MM-DD"));
  const [to, setTo] = useState(dayjs().endOf("month").format("YYYY-MM-DD"));

  //  ZenStack v3.3.0 official pattern
  const client = useClientQueries(schemaLite);
  const { data: events, isLoading } = client.event.useFindMany({
    where: {
      AND: [
        { startDate: { gte: dayjs(from, "YYYY-MM-DD").toDate() } },
        { startDate: { lte: dayjs(to, "YYYY-MM-DD").toDate() } },
      ],
    },
    orderBy: { startDateTime: "desc" },
  });

  // Group by date
  const grouped = (events || []).reduce(
    (acc, event) => {
      const date = event.startDate ? dayjs(event.startDate).format("YYYY-MM-DD") : "Sin fecha";
      if (!acc[date]) {
        acc[date] = [];
      }
      acc[date].push(event);
      return acc;
    },
    {} as Record<string, EventForDaily[]>,
  );

  const sortedDates = Object.keys(grouped).sort((a, b) => b.localeCompare(a));

  return (
    <div className="space-y-6 p-6 md:p-8">
      <div className="flex items-center justify-between">
        <h1 className="font-bold text-2xl">Detalle Diario de Ingresos</h1>
        <div className="flex items-center gap-2">
          <Input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="w-40"
            aria-label="Fecha inicio"
          />
          <span className="text-default-400">-</span>
          <Input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="w-40"
            aria-label="Fecha fin"
          />
        </div>
      </div>

      <div className="space-y-4">
        {isLoading && (
          <div className="space-y-3 py-2">
            {Array.from({ length: 3 }).map((_, index) => (
              <Card key={`daily-income-skeleton-${index + 1}`} className="w-full">
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
          <Alert color="warning">No se encontraron eventos para este periodo.</Alert>
        )}

        {sortedDates.map((date) => {
          const dayEvents = grouped[date] ?? [];
          const totalExpected = dayEvents.reduce(
            (sum: number, e: EventForDaily) => sum + (e.amountExpected || 0),
            0,
          );
          const totalPaid = dayEvents.reduce(
            (sum: number, e: EventForDaily) => sum + (e.amountPaid || 0),
            0,
          );

          return (
            <Card key={date} className="w-full">
              <Card.Content className="gap-4 p-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-lg capitalize">
                    {dayjs(date, "YYYY-MM-DD").format("dddd D [de] MMMM")}
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
                        <Chip size="sm" variant="soft" className="h-5 text-[10px]">
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
