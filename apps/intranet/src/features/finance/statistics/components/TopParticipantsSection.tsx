/**
 * Top Participants Section Component
 */

import { Alert, Card, Skeleton } from "@heroui/react";
import { Users2 } from "lucide-react";
import { lazy, Suspense } from "react";

import type { TopParticipantData } from "../types";

// Lazy load pie chart
const TopParticipantsPieChart = lazy(() =>
  import("./TopParticipantsPieChart.js").then((m) => ({ default: m.TopParticipantsPieChart })),
);

interface TopParticipantsSectionProps {
  data: TopParticipantData[];
  error: null | string;
  loading: boolean;
}
export function TopParticipantsSection({ data, error, loading }: TopParticipantsSectionProps) {
  return (
    <Card className="p-6">
      <h2 className="mb-4 flex items-center gap-2 font-bold text-lg">
        <Users2 className="h-5 w-5 text-secondary" />
        Top Contrapartes (Egresos)
      </h2>

      {loading && (
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-3">
            <Skeleton className="h-60 w-full rounded-xl" />
          </div>
          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <div
                className="flex items-center justify-between rounded-lg border border-default-200 p-3"
                key={`top-participant-skeleton-${index + 1}`}
              >
                <div className="flex items-center gap-3">
                  <Skeleton className="h-8 w-8 rounded-full" />
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-32 rounded-md" />
                    <Skeleton className="h-3 w-24 rounded-md" />
                  </div>
                </div>
                <Skeleton className="h-4 w-20 rounded-md" />
              </div>
            ))}
          </div>
        </div>
      )}

      {error && <Alert color="danger">{error}</Alert>}

      {!loading && !error && data.length === 0 && (
        <div className="py-8 text-center text-default-500 text-sm">
          No hay datos de contrapartes para mostrar
        </div>
      )}

      {!loading && !error && data.length > 0 && (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Chart */}
          <Suspense fallback={<Skeleton className="h-60 w-full rounded-xl" />}>
            <TopParticipantsPieChart data={data.slice(0, 5)} />
          </Suspense>

          {/* List */}
          <div className="space-y-2">
            {data.slice(0, 10).map((participant, index) => (
              <div
                className="flex items-center justify-between rounded-lg p-3 transition-colors hover:bg-default-50/50"
                key={participant.personId}
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 font-bold text-primary text-sm">
                    {index + 1}
                  </div>
                  <div>
                    <div className="font-medium">{participant.personName}</div>
                    <div className="text-default-500 text-xs">
                      {participant.count}{" "}
                      {participant.count === 1 ? "transacción" : "transacciones"}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-mono font-semibold text-sm">
                    ${participant.total.toLocaleString("es-CL")}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}
