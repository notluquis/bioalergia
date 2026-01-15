import { useSuspenseQuery } from "@tanstack/react-query";
import { Lock } from "lucide-react";

import Button from "@/components/ui/Button";
import AssociatedAccounts from "@/features/counterparts/components/AssociatedAccounts";
import { counterpartKeys } from "@/features/counterparts/queries";
import { ServicesSurface } from "@/features/services/components/ServicesShell";

interface CounterpartDetailSectionProps {
  counterpartId: number;
  summaryRange: { from: string; to: string };
  onSummaryRangeChange: (update: Partial<{ from: string; to: string }>) => void;
  canUpdate: boolean;
  onEdit: (counterpart: any) => void;
}

export default function CounterpartDetailSection({
  counterpartId,
  summaryRange,
  onSummaryRangeChange,
  canUpdate,
  onEdit,
}: CounterpartDetailSectionProps) {
  const { data: detail } = useSuspenseQuery(counterpartKeys.detail(counterpartId));
  const { data: summary } = useSuspenseQuery(counterpartKeys.summary(counterpartId, summaryRange));

  if (!detail) return null; // Should not happen with suspense if data exists

  return (
    <div className="space-y-6">
      <ServicesSurface className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-base-content/60 text-xs tracking-[0.3em] uppercase">Contraparte activa</p>
            <h3 className="text-base-content text-lg font-semibold">{detail.counterpart.name}</h3>
            {detail.counterpart.rut && <p className="text-base-content/70 text-xs">RUT {detail.counterpart.rut}</p>}
          </div>
          <Button
            size="sm"
            variant="ghost"
            disabled={!canUpdate}
            onClick={() => onEdit(detail.counterpart)}
            title={canUpdate ? undefined : "No tienes permisos para editar"}
          >
            {!canUpdate && <Lock className="mr-2 h-3 w-3" />}
            Editar contraparte
          </Button>
        </div>
        <div className="text-base-content/70 grid gap-3 text-xs sm:grid-cols-2">
          <div>
            <p className="text-base-content/60 font-semibold">Clasificación</p>
            <p className="text-base-content text-sm">{detail.counterpart.category ?? "—"}</p>
          </div>
          <div>
            <p className="text-base-content/60 font-semibold">Tipo de persona</p>
            <p className="text-base-content text-sm">{detail.counterpart.personType}</p>
          </div>
          {detail.counterpart.email && (
            <div className="sm:col-span-2">
              <p className="text-base-content/60 font-semibold">Correo electrónico</p>
              <p className="text-base-content text-sm">{detail.counterpart.email}</p>
            </div>
          )}
        </div>
      </ServicesSurface>

      <AssociatedAccounts
        selectedId={counterpartId}
        detail={detail}
        summary={summary}
        summaryRange={summaryRange}
        onSummaryRangeChange={onSummaryRangeChange}
      />
    </div>
  );
}
