import { useSuspenseQuery } from "@tanstack/react-query";
import { Lock } from "lucide-react";

import Button from "@/components/ui/Button";
import AssociatedAccounts from "@/features/counterparts/components/AssociatedAccounts";
import { counterpartKeys } from "@/features/counterparts/queries";
import type { Counterpart } from "@/features/counterparts/types";
import { ServicesSurface } from "@/features/services/components/ServicesShell";

interface CounterpartDetailSectionProps {
  canUpdate: boolean;
  counterpartId: number;
  onEdit: (counterpart: Counterpart) => void;
  onSummaryRangeChange: (update: Partial<{ from: string; to: string }>) => void;
  summaryRange: { from: string; to: string };
}

export default function CounterpartDetailSection({
  canUpdate,
  counterpartId,
  onEdit,
  onSummaryRangeChange,
  summaryRange,
}: Readonly<CounterpartDetailSectionProps>) {
  const { data: detail } = useSuspenseQuery(counterpartKeys.detail(counterpartId));
  const { data: summary } = useSuspenseQuery(counterpartKeys.summary(counterpartId, summaryRange));

  if (!detail) {
    return null; // Should not happen with suspense if data exists
  }

  return (
    <div className="space-y-6">
      <ServicesSurface className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-default-500 text-xs uppercase tracking-[0.3em]">
              Contraparte activa
            </p>
            <h3 className="font-semibold text-foreground text-lg">{detail.counterpart.name}</h3>
            {detail.counterpart.rut && (
              <p className="text-default-600 text-xs">RUT {detail.counterpart.rut}</p>
            )}
          </div>
          <Button
            disabled={!canUpdate}
            onClick={() => {
              onEdit(detail.counterpart);
            }}
            size="sm"
            title={canUpdate ? undefined : "No tienes permisos para editar"}
            variant="ghost"
          >
            {!canUpdate && <Lock className="mr-2 h-3 w-3" />}
            Editar contraparte
          </Button>
        </div>
        <div className="grid gap-3 text-default-600 text-xs sm:grid-cols-2">
          <div>
            <p className="font-semibold text-default-500">Clasificación</p>
            <p className="text-foreground text-sm">{detail.counterpart.category ?? "—"}</p>
          </div>
          <div>
            <p className="font-semibold text-default-500">Tipo de persona</p>
            <p className="text-foreground text-sm">{detail.counterpart.personType}</p>
          </div>
          {detail.counterpart.email && (
            <div className="sm:col-span-2">
              <p className="font-semibold text-default-500">Correo electrónico</p>
              <p className="text-foreground text-sm">{detail.counterpart.email}</p>
            </div>
          )}
        </div>
      </ServicesSurface>

      <AssociatedAccounts
        detail={detail}
        onSummaryRangeChange={onSummaryRangeChange}
        selectedId={counterpartId}
        summary={summary}
        summaryRange={summaryRange}
      />
    </div>
  );
}
