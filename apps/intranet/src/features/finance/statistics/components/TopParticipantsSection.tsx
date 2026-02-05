/**
 * Top Participants Section Component
 */

import { Alert, Card, Spinner } from "@heroui/react";
import { Users2 } from "lucide-react";
import { lazy, Suspense } from "react";

import type { TopParticipantData } from "../types";

// Lazy load pie chart
const TopParticipantsPieChart = lazy(() => import("./TopParticipantsPieChart.js"));

interface TopParticipantsSectionProps {
  data: TopParticipantData[];
  error: null | string;
  loading: boolean;
}

export default function TopParticipantsSection({
  data,
  error,
  loading,
}: TopParticipantsSectionProps) {
  return (
    <Card className="p-6">
      <h2 className="mb-4 flex items-center gap-2 font-bold text-lg">
        <Users2 className="h-5 w-5 text-secondary" />
        Top Contrapartes (Egresos)
      </h2>

      {loading && (
        <div className="flex h-60 items-center justify-center">
          <Spinner className="text-primary" color="current" size="lg" />
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
          <Suspense
            fallback={
              <div className="flex h-60 items-center justify-center">
                <Spinner className="text-primary" color="current" size="md" />
              </div>
            }
          >
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
