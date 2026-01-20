import type { Event } from "@finanzas/db";
import { useFindManyEvent } from "@finanzas/db/hooks";
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
        <div className="flex gap-2">
          <input
            type="date"
            className="input input-sm input-bordered"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
          <input
            type="date"
            className="input input-sm input-bordered"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </div>
      </div>

      <div className="space-y-4">
        {isLoading && <span className="loading loading-spinner"></span>}

        {!isLoading && sortedDates.length === 0 && (
          <div className="alert">No se encontraron eventos para este periodo.</div>
        )}

        {sortedDates.map((date) => {
          const dayEvents = grouped[date] ?? [];
          const totalExpected = dayEvents.reduce(
            (sum: number, e: any) => sum + (e.amountExpected || 0),
            0,
          );
          const totalPaid = dayEvents.reduce((sum: number, e: any) => sum + (e.amountPaid || 0), 0);

          return (
            <div key={date} className="card bg-base-100 shadow-sm border border-base-200">
              <div className="card-body p-4">
                <div className="flex justify-between items-center mb-2">
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
                <ul className="space-y-2 mt-2">
                  {dayEvents.map((event: any) => (
                    <li key={event.id} className="flex justify-between text-sm">
                      <span>
                        {event.summary || "Evento sin título"}{" "}
                        <span className="badge badge-xs text-xs">{event.eventType}</span>
                      </span>
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
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
