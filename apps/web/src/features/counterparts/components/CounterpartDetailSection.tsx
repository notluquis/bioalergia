import { useSuspenseQuery } from "@tanstack/react-query";
import { Lock } from "lucide-react";

import Button from "@/components/ui/Button";
import AssociatedAccounts from "@/features/counterparts/components/AssociatedAccounts";
import { counterpartKeys } from "@/features/counterparts/queries";
import { ServicesSurface } from "@/features/services/components/ServicesShell";

interface CounterpartDetailSectionProps {
  canUpdate: boolean;
  counterpartId: number;
  // biome-ignore lint/suspicious/noExplicitAny: legacy handler
  onEdit: (counterpart: any) => void;
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

  if (!detail) return null; // Should not happen with suspense if data exists

  return (
    <div className="space-y-6">
      <ServicesSurface className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-default-500 text-xs tracking-[0.3em] uppercase">
              Contraparte activa
            </p>
            <h3 className="text-foreground text-lg font-semibold">{detail.counterpart.name}</h3>
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
        <div className="text-default-600 grid gap-3 text-xs sm:grid-cols-2">
          <div>
            <p className="text-default-500 font-semibold">Clasificación</p>
            <p className="text-foreground text-sm">{detail.counterpart.category ?? "—"}</p>
          </div>
          <div>
            <p className="text-default-500 font-semibold">Tipo de persona</p>
            <p className="text-foreground text-sm">{detail.counterpart.personType}</p>
          </div>
          {detail.counterpart.email && (
            <div className="sm:col-span-2">
              <p className="text-default-500 font-semibold">Correo electrónico</p>
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
