import type { Event } from "@finanzas/db";
import { useFindManyEvent } from "@finanzas/db/hooks";
import { Alert, Card, Chip, Input, Spinner } from "@heroui/react";
import dayjs from "dayjs";
import { useState } from "react";

export function DailyIncomePage() {
  const [from, setFrom] = useState(dayjs().startOf("month").format("YYYY-MM-DD"));
  const [to, setTo] = useState(dayjs().endOf("month").format("YYYY-MM-DD"));

  const { data: events, isLoading } = useFindManyEvent({
    where: {
      AND: [{ startDate: { gte: new Date(from) } }, { startDate: { lte: new Date(to) } }],
    },
    orderBy: { startDateTime: "desc" },
  });

  // Group by date
  const grouped = (events || []).reduce(
    (acc, event) => {
      const date = event.startDate ? dayjs(event.startDate).format("YYYY-MM-DD") : "Sin fecha";
      if (!acc[date]) acc[date] = [];
      acc[date].push(event);
      return acc;
    },
    {} as Record<string, Event[]>,
  );

  const sortedDates = Object.keys(grouped).sort((a, b) => b.localeCompare(a));

  return (
    <div className="space-y-6 p-6 md:p-8">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Detalle Diario de Ingresos</h1>
        <div className="flex gap-2 items-center">
          <Input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="w-40"
            aria-label="Fecha inicio"
          />
          <span className="text-base-content/50">-</span>
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
          <div className="flex justify-center py-8">
            <Spinner />
          </div>
        )}

        {!isLoading && sortedDates.length === 0 && (
          <Alert color="warning">No se encontraron eventos para este periodo.</Alert>
        )}

        {sortedDates.map((date) => {
          const dayEvents = grouped[date] ?? [];
          const totalExpected = dayEvents.reduce(
            (sum: number, e: Event) => sum + (e.amountExpected || 0),
            0,
          );
          const totalPaid = dayEvents.reduce(
            (sum: number, e: Event) => sum + (e.amountPaid || 0),
            0,
          );

          return (
            <Card key={date} className="w-full">
              <Card.Content className="p-4 gap-4">
                <div className="flex justify-between items-center">
                  <h3 className="font-semibold text-lg capitalize">
                    {dayjs(date).format("dddd D [de] MMMM")}
                  </h3>
                  <div className="text-right text-sm">
                    <div className="text-base-content/70">
                      Esperado: ${totalExpected.toLocaleString()}
                    </div>
                    <div className="font-bold text-success">
                      Pagado: ${totalPaid.toLocaleString()}
                    </div>
                  </div>
                </div>
                <div className="divider my-0"></div>
                <ul className="space-y-2">
                  {dayEvents.map((event: Event) => (
                    <li key={event.id} className="flex justify-between text-sm items-center">
                      <div className="flex items-center gap-2">
                        <span>{event.summary || "Evento sin título"}</span>
                        <Chip size="sm" variant="soft" className="h-5 text-[10px]">
                          {event.eventType}
                        </Chip>
                      </div>
                      <span
                        className={
                          event.amountPaid ? "text-success font-medium" : "text-base-content/50"
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
