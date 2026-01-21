/**
 * Top Participants Section Component
 */

import { Spinner } from "@heroui/react";
import { Users2 } from "lucide-react";
import { lazy, Suspense } from "react";

import Alert from "@/components/ui/Alert";

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
    <div className="bg-base-100 border-base-200 rounded-2xl border p-6 shadow-sm">
      <h2 className="mb-4 flex items-center gap-2 text-lg font-bold">
        <Users2 className="text-secondary h-5 w-5" />
        Top Contrapartes (Egresos)
      </h2>

      {loading && (
        <div className="flex h-60 items-center justify-center">
          <Spinner className="text-primary" color="current" size="lg" />
        </div>
      )}

      {error && <Alert variant="error">{error}</Alert>}

      {!loading && !error && data.length === 0 && (
        <div className="text-base-content/60 py-8 text-center text-sm">
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
                className="hover:bg-base-200/50 flex items-center justify-between rounded-lg p-3 transition-colors"
                key={participant.personId}
              >
                <div className="flex items-center gap-3">
                  <div className="bg-primary/10 text-primary flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold">
                    {index + 1}
                  </div>
                  <div>
                    <div className="font-medium">{participant.personName}</div>
                    <div className="text-base-content/60 text-xs">
                      {participant.count}{" "}
                      {participant.count === 1 ? "transacción" : "transacciones"}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-mono text-sm font-semibold">
                    ${participant.total.toLocaleString("es-CL")}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
