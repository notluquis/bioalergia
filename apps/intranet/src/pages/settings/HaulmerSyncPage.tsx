import { Card, Chip, Spinner } from "@heroui/react";
import { useMutation, useQuery } from "@tanstack/react-query";
import dayjs from "dayjs";
import localeEs from "dayjs/locale/es";
import { Check, Download, X } from "lucide-react";
import { useMemo, useState } from "react";
import { z } from "zod";

import { Button } from "@/components/ui/Button";
import { useToast } from "@/context/ToastContext";
import { apiClient } from "@/lib/api-client";

dayjs.locale(localeEs);

// Response schema for available periods
const AvailablePeriodsSchema = z.object({
  status: z.string(),
  sales: z.array(z.string()),
  purchases: z.array(z.string()),
});

// Response schema for sync results
const SyncResultSchema = z.object({
  period: z.string(),
  docType: z.enum(["sales", "purchases"]),
  status: z.enum(["success", "failed"]),
  rowsProcessed: z.number(),
  rowsInserted: z.number(),
  rowsUpdated: z.number(),
  error: z.string().nullable().optional(),
});

const SyncResponseSchema = z.object({
  status: z.string(),
  results: z.array(SyncResultSchema),
  summary: z.object({
    total: z.number(),
    success: z.number(),
    failed: z.number(),
  }),
});

interface SyncResult extends z.infer<typeof SyncResultSchema> {}

interface MonthPeriod {
  period: string;
  year: number;
  month: string;
  monthNumber: number;
}

const MONTHS_ES = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

function generatePeriods(): MonthPeriod[] {
  const periods: MonthPeriod[] = [];
  const now = dayjs();

  for (let i = 0; i < 24; i++) {
    const date = now.subtract(i, "months");
    const year = date.year();
    const month = date.month() + 1;
    const monthStr = String(month).padStart(2, "0");
    const period = `${year}${monthStr}`;
    const monthName = MONTHS_ES[month - 1];

    if (monthName !== undefined) {
      periods.push({
        period,
        year,
        month: monthName,
        monthNumber: month,
      });
    }
  }

  return periods;
}

interface LastSyncState {
  [key: string]: SyncResult | null;
}

// Helper component for sync status icon
function SyncStatusIcon({ result }: { result: SyncResult | null | undefined }) {
  if (!result) {
    return null;
  }
  if (result.status === "success") {
    return <Check className="h-4 w-4 text-green-500" />;
  }
  if (result.status === "failed") {
    return <X className="h-4 w-4 text-red-500" />;
  }
  return <span className="text-gray-500 text-xs">Pendiente</span>;
}

export function HaulmerSyncPage() {
  const { error: showError, success: showSuccess } = useToast();
  const [lastSyncs, setLastSyncs] = useState<LastSyncState>({});

  // Fetch available periods
  const { data: availablePeriods, isLoading: isLoadingPeriods } = useQuery({
    queryKey: ["haulmer-available-periods"],
    queryFn: async () => {
      const response = await apiClient.get<z.infer<typeof AvailablePeriodsSchema>>(
        "/haulmer/available-periods",
        { responseSchema: AvailablePeriodsSchema },
      );
      return response;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const periods = useMemo(() => generatePeriods(), []);
  const periodsByYear = useMemo(() => {
    const result: Record<number, MonthPeriod[] | undefined> = {};
    for (const period of periods) {
      const year = period.year;
      if (result[year] === undefined) {
        result[year] = [];
      }
      const yearPeriods = result[year];
      if (yearPeriods !== undefined) {
        yearPeriods.push(period);
      }
    }
    return result;
  }, [periods]);

  const syncMutation = useMutation({
    mutationFn: async (params: { period: string; docType: "sales" | "purchases" }) => {
      const response = await apiClient.post<z.infer<typeof SyncResponseSchema>>(
        "/haulmer/sync",
        {
          periods: [params.period],
          docTypes: [params.docType],
        },
        { responseSchema: SyncResponseSchema },
      );
      return response.results?.[0];
    },
    onError: (error: Error) => {
      showError(`Error al sincronizar: ${error.message}`);
    },
    onSuccess: (result, { period, docType }) => {
      if (!result) {
        return;
      }
      const key = `${period}-${docType}`;
      setLastSyncs((prev) => ({
        ...prev,
        [key]: result,
      }));

      if (result.status === "success") {
        const msg = `${result.rowsInserted} creados, ${result.rowsUpdated} actualizados`;
        showSuccess(`Sync completado: ${msg}`);
      } else if (result.error) {
        showError(`Sync fallido: ${result.error}`);
      }
    },
  });

  const handleSync = (period: string, docType: "sales" | "purchases") => {
    const docLabel = docType === "sales" ? "ventas" : "compras";
    const message = `¿Sincronizar ${docLabel} de ${period}? Esto puede insertar o actualizar registros.`;
    if (confirm(message)) {
      syncMutation.mutate({ period, docType });
    }
  };

  const hasSalesData = (period: string) => availablePeriods?.sales?.includes(period) ?? false;
  const hasPurchasesData = (period: string) =>
    availablePeriods?.purchases?.includes(period) ?? false;

  const sortedYears = Object.keys(periodsByYear)
    .map(Number)
    .sort((a, b) => b - a);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="font-bold text-2xl">Sincronización Haulmer</h1>
        <p className="mt-1 text-default-500 text-sm">
          Descarga e importa registros de ventas y compras desde Haulmer
        </p>
      </div>

      {/* Loading State */}
      {isLoadingPeriods && (
        <Card className="border-warning-100 bg-warning-50">
          <div className="flex items-center gap-2 p-4">
            <Spinner size="sm" />
            <p className="text-default-700 text-sm">Cargando períodos disponibles...</p>
          </div>
        </Card>
      )}

      {/* Info Card */}
      <Card className="border-primary-100 bg-primary-50">
        <div className="p-4 text-sm">
          <p className="text-default-700">
            🔄 <strong>Cómo funciona:</strong> Selecciona un período (mes/año) y un tipo de
            documento. El sistema descargará el CSV de Haulmer e importará los datos.
          </p>
        </div>
      </Card>

      {/* By Year */}
      {sortedYears.map((year) => (
        <div key={year} className="space-y-4">
          <h2 className="font-semibold text-default-700 text-lg">{year}</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {(periodsByYear[year] ?? []).map((period) => (
              <Card key={period.period} className="border-default-100">
                <div className="gap-4 space-y-4 p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium text-base">{period.month}</h4>
                      <p className="text-default-500 text-xs">{period.period}</p>
                    </div>
                    {syncMutation.isPending && syncMutation.variables?.period === period.period && (
                      <Spinner size="sm" />
                    )}
                  </div>

                  {/* Sales Section */}
                  <div className="space-y-2 border-default-100 border-t pt-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Ventas</span>
                      <div className="flex items-center gap-2">
                        {hasSalesData(period.period) ? (
                          <Chip color="success" size="sm">
                            Datos
                          </Chip>
                        ) : (
                          <Chip color="default" size="sm">
                            Sin datos
                          </Chip>
                        )}
                        <SyncStatusIcon result={lastSyncs[`${period.period}-sales`]} />
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="primary"
                      disabled={
                        !hasSalesData(period.period) ||
                        (syncMutation.isPending && syncMutation.variables?.period === period.period)
                      }
                      onClick={() => {
                        handleSync(period.period, "sales");
                      }}
                      startContent={<Download className="h-4 w-4" />}
                    >
                      Importar
                    </Button>
                    {lastSyncs[`${period.period}-sales`] && (
                      <div className="space-y-1 text-default-600 text-xs">
                        <p>Creados: {lastSyncs[`${period.period}-sales`]?.rowsInserted}</p>
                        <p>Actualizados: {lastSyncs[`${period.period}-sales`]?.rowsUpdated}</p>
                        {lastSyncs[`${period.period}-sales`]?.error && (
                          <p className="text-red-500">
                            Error: {lastSyncs[`${period.period}-sales`]?.error}
                          </p>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Purchases Section */}
                  <div className="space-y-2 border-default-100 border-t pt-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Compras</span>
                      <div className="flex items-center gap-2">
                        {hasPurchasesData(period.period) ? (
                          <Chip color="success" size="sm">
                            Datos
                          </Chip>
                        ) : (
                          <Chip color="default" size="sm">
                            Sin datos
                          </Chip>
                        )}
                        <SyncStatusIcon result={lastSyncs[`${period.period}-purchases`]} />
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="primary"
                      disabled={
                        !hasPurchasesData(period.period) ||
                        (syncMutation.isPending && syncMutation.variables?.period === period.period)
                      }
                      onClick={() => {
                        handleSync(period.period, "purchases");
                      }}
                      startContent={<Download className="h-4 w-4" />}
                    >
                      Importar
                    </Button>
                    {lastSyncs[`${period.period}-purchases`] && (
                      <div className="space-y-1 text-default-600 text-xs">
                        <p>Creados: {lastSyncs[`${period.period}-purchases`]?.rowsInserted}</p>
                        <p>Actualizados: {lastSyncs[`${period.period}-purchases`]?.rowsUpdated}</p>
                        {lastSyncs[`${period.period}-purchases`]?.error && (
                          <p className="text-red-500">
                            Error: {lastSyncs[`${period.period}-purchases`]?.error}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
