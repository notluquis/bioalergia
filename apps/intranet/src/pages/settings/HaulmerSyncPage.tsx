import { Card, Chip, Description, Spinner } from "@heroui/react";
import { useMutation, useQuery } from "@tanstack/react-query";
import dayjs from "dayjs";
import localeEs from "dayjs/locale/es";
import { Check, Download, RefreshCw, X } from "lucide-react";
import { useMemo, useState } from "react";
import { z } from "zod";

import { Button } from "@/components/ui/Button";
import { useToast } from "@/context/ToastContext";
import { apiClient } from "@/lib/api-client";

dayjs.locale(localeEs);

// Response schema for available periods
const AvailablePeriodsSchema = z.object({
  status: z.string(),
  sales: z.array(
    z.object({
      periodo: z.string(),
      count: z.number(),
    }),
  ),
  purchases: z.array(
    z.object({
      periodo: z.string(),
      count: z.number(),
    }),
  ),
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
  salesCount: number;
  purchasesCount: number;
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

/**
 * Convert period string (YYYYMM) to MonthPeriod object
 */
function periodToMonthPeriod(
  periodoStr: string,
  salesCount: number = 0,
  purchasesCount: number = 0,
): MonthPeriod {
  const year = Number.parseInt(periodoStr.substring(0, 4), 10);
  const monthNumber = Number.parseInt(periodoStr.substring(4, 6), 10);
  const monthName = MONTHS_ES[monthNumber - 1] || "Desconocido";

  return {
    period: periodoStr,
    year,
    month: monthName,
    monthNumber,
    salesCount,
    purchasesCount,
  };
}

interface AvailablePeriodsData extends z.infer<typeof AvailablePeriodsSchema> {}

/**
 * Extract all periods from available periods data, grouped by year
 */
function extractAndGroupPeriods(
  availablePeriods: AvailablePeriodsData,
): Record<number, MonthPeriod[]> {
  const periodMap = new Map<string, { sales: number; purchases: number }>();

  // Collect all periods with their counts
  for (const sale of availablePeriods.sales) {
    if (!periodMap.has(sale.periodo)) {
      periodMap.set(sale.periodo, { sales: 0, purchases: 0 });
    }
    const data = periodMap.get(sale.periodo);
    if (data) {
      data.sales = sale.count;
    }
  }

  for (const purchase of availablePeriods.purchases) {
    if (!periodMap.has(purchase.periodo)) {
      periodMap.set(purchase.periodo, { sales: 0, purchases: 0 });
    }
    const data = periodMap.get(purchase.periodo);
    if (data) {
      data.purchases = purchase.count;
    }
  }

  // Convert to MonthPeriod array, sorted by period descending (newest first)
  const periods = Array.from(periodMap.entries())
    .map(([period, counts]) => periodToMonthPeriod(period, counts.sales, counts.purchases))
    .sort((a, b) => b.period.localeCompare(a.period));

  // Group by year
  const grouped: Record<number, MonthPeriod[]> = {};
  for (const period of periods) {
    if (!grouped[period.year]) {
      grouped[period.year] = [];
    }
    const yearPeriods = grouped[period.year];
    if (yearPeriods) {
      yearPeriods.push(period);
    }
  }

  return grouped;
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

interface SyncAllCardProps {
  isSyncingAll: boolean;
  syncAllProgress: { completed: number; total: number };
  availablePeriods: AvailablePeriodsData | undefined;
  onSyncAll: () => void;
}

function SyncAllCard({
  isSyncingAll,
  syncAllProgress,
  availablePeriods,
  onSyncAll,
}: SyncAllCardProps) {
  if (!availablePeriods) {
    return null;
  }

  const totalPeriods =
    (availablePeriods.sales?.length ?? 0) + (availablePeriods.purchases?.length ?? 0);
  if (totalPeriods === 0) {
    return null;
  }

  return (
    <Card className="border-primary-100 bg-primary-50">
      <div className="space-y-4 p-4">
        <div className="flex items-center justify-between">
          <div>
            <span className="block font-semibold text-default-700">Sincronización Masiva</span>
            <div className="mt-1">
              <Description className="text-default-500 text-sm">
                Datos disponibles: {availablePeriods.sales.length} períodos de ventas +{" "}
                {availablePeriods.purchases.length} períodos de compras
              </Description>
            </div>
          </div>
          <Button
            isDisabled={isSyncingAll}
            isLoading={isSyncingAll}
            color="primary"
            onClick={onSyncAll}
            startContent={isSyncingAll ? undefined : <RefreshCw className="h-4 w-4" />}
          >
            {isSyncingAll ? "Sincronizando..." : "Sincronizar Todo"}
          </Button>
        </div>

        {isSyncingAll && syncAllProgress.total > 0 && (
          <div className="space-y-2">
            <div className="h-2 w-full rounded bg-default-200">
              <div
                className="h-2 rounded bg-success-500 transition-all duration-300"
                style={{
                  width: `${(syncAllProgress.completed / syncAllProgress.total) * 100}%`,
                }}
              />
            </div>
            <Description className="text-default-600 text-xs">
              {syncAllProgress.completed} de {syncAllProgress.total} completados
            </Description>
          </div>
        )}
      </div>
    </Card>
  );
}

interface PeriodCardProps {
  period: MonthPeriod;
  lastSyncs: LastSyncState;
  syncMutation: {
    isPending: boolean;
    variables?: { period: string; docType: "sales" | "purchases" };
  };
  onSync: (period: string, docType: "sales" | "purchases") => void;
  hasSalesData: (period: string) => boolean;
  hasPurchasesData: (period: string) => boolean;
  getSalesCount: (period: string) => number;
  getPurchasesCount: (period: string) => number;
}

function PeriodCard({
  period,
  lastSyncs,
  syncMutation,
  onSync,
  hasSalesData,
  hasPurchasesData,
  getSalesCount,
  getPurchasesCount,
}: PeriodCardProps) {
  return (
    <Card key={period.period} className="border-default-100">
      <div className="gap-4 space-y-4 p-4">
        <div className="flex items-center justify-between">
          <div>
            <span className="block font-medium text-base">{period.month}</span>
            <Description className="text-default-500 text-xs">{period.period}</Description>
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
                <Chip color="success" size="sm" variant="secondary">
                  <Chip.Label>{getSalesCount(period.period)} docs</Chip.Label>
                </Chip>
              ) : (
                <Chip color="default" size="sm" variant="secondary">
                  <Chip.Label>Sin datos</Chip.Label>
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
              onSync(period.period, "sales");
            }}
            startContent={<Download className="h-4 w-4" />}
          >
            Importar
          </Button>
          {lastSyncs[`${period.period}-sales`] && (
            <div className="space-y-1 text-default-600 text-xs">
              <span className="block">
                Creados: {lastSyncs[`${period.period}-sales`]?.rowsInserted}
              </span>
              <span className="block">
                Actualizados: {lastSyncs[`${period.period}-sales`]?.rowsUpdated}
              </span>
              {lastSyncs[`${period.period}-sales`]?.error && (
                <span className="block text-red-500">
                  Error: {lastSyncs[`${period.period}-sales`]?.error}
                </span>
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
                <Chip color="success" size="sm" variant="secondary">
                  <Chip.Label>{getPurchasesCount(period.period)} docs</Chip.Label>
                </Chip>
              ) : (
                <Chip color="default" size="sm" variant="secondary">
                  <Chip.Label>Sin datos</Chip.Label>
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
              onSync(period.period, "purchases");
            }}
            startContent={<Download className="h-4 w-4" />}
          >
            Importar
          </Button>
          {lastSyncs[`${period.period}-purchases`] && (
            <div className="space-y-1 text-default-600 text-xs">
              <span className="block">
                Creados: {lastSyncs[`${period.period}-purchases`]?.rowsInserted}
              </span>
              <span className="block">
                Actualizados: {lastSyncs[`${period.period}-purchases`]?.rowsUpdated}
              </span>
              {lastSyncs[`${period.period}-purchases`]?.error && (
                <span className="block text-red-500">
                  Error: {lastSyncs[`${period.period}-purchases`]?.error}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

export function HaulmerSyncPage() {
  const { error: showError, success: showSuccess } = useToast();
  const [lastSyncs, setLastSyncs] = useState<LastSyncState>({});
  const [syncAllProgress, setSyncAllProgress] = useState({ completed: 0, total: 0 });
  const [isSyncingAll, setIsSyncingAll] = useState(false);

  // Fetch available periods
  const {
    data: availablePeriods,
    isLoading: isLoadingPeriods,
    error: periodsError,
  } = useQuery({
    queryKey: ["haulmer-available-periods"],
    queryFn: async () => {
      const response = await apiClient.get<z.infer<typeof AvailablePeriodsSchema>>(
        "/api/haulmer/available-periods",
        { responseSchema: AvailablePeriodsSchema },
      );
      return response;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Generate periods from available data (not hardcoded)
  const periodsByYear = useMemo(() => {
    if (!availablePeriods) {
      return {};
    }
    return extractAndGroupPeriods(availablePeriods);
  }, [availablePeriods]);

  const syncMutation = useMutation({
    mutationFn: async (params: { period: string; docType: "sales" | "purchases" }) => {
      const response = await apiClient.post<z.infer<typeof SyncResponseSchema>>(
        "/api/haulmer/sync",
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

  const buildSyncTasks = () => {
    if (!availablePeriods) {
      return [];
    }

    const tasks: Array<{ period: string; docType: "sales" | "purchases" }> = [];
    for (const sale of availablePeriods.sales) {
      tasks.push({ period: sale.periodo, docType: "sales" });
    }
    for (const purchase of availablePeriods.purchases) {
      tasks.push({ period: purchase.periodo, docType: "purchases" });
    }
    return tasks;
  };

  const executeSyncBatch = async (
    tasks: Array<{ period: string; docType: "sales" | "purchases" }>,
  ) => {
    const batchSize = 5;
    for (let i = 0; i < tasks.length; i += batchSize) {
      const batch = tasks.slice(i, i + batchSize);
      await Promise.all(
        batch.map((task) =>
          apiClient
            .post<z.infer<typeof SyncResponseSchema>>(
              "/api/haulmer/sync",
              {
                periods: [task.period],
                docTypes: [task.docType],
              },
              { responseSchema: SyncResponseSchema },
            )
            .then((response) => {
              const result = response.results?.[0];
              if (result) {
                const key = `${task.period}-${task.docType}`;
                setLastSyncs((prev) => ({
                  ...prev,
                  [key]: result,
                }));
              }
              setSyncAllProgress((prev) => ({
                ...prev,
                completed: prev.completed + 1,
              }));
            })
            .catch((error) => {
              console.error(`Error syncing ${task.period}-${task.docType}:`, error);
              setSyncAllProgress((prev) => ({
                ...prev,
                completed: prev.completed + 1,
              }));
            }),
        ),
      );
    }
  };

  const handleSyncAll = async () => {
    const syncTasks = buildSyncTasks();
    if (syncTasks.length === 0) {
      return;
    }

    const message = `¿Sincronizar TODOS los períodos? Se sincronizarán ${syncTasks.length} registros (${availablePeriods?.sales.length ?? 0} sales + ${availablePeriods?.purchases.length ?? 0} purchases). Esto puede tomar un tiempo.`;
    if (!confirm(message)) {
      return;
    }

    setIsSyncingAll(true);
    setSyncAllProgress({ completed: 0, total: syncTasks.length });

    try {
      await executeSyncBatch(syncTasks);
      showSuccess(`Sincronización completada: ${syncAllProgress.total} períodos procesados`);
    } catch (error) {
      showError(
        `Error durante sincronización masiva: ${error instanceof Error ? error.message : "Desconocido"}`,
      );
    } finally {
      setIsSyncingAll(false);
      setSyncAllProgress({ completed: 0, total: 0 });
    }
  };

  const hasSalesData = (period: string) =>
    availablePeriods?.sales?.some((p) => p.periodo === period) ?? false;
  const hasPurchasesData = (period: string) =>
    availablePeriods?.purchases?.some((p) => p.periodo === period) ?? false;

  const getSalesCount = (period: string) =>
    availablePeriods?.sales?.find((p) => p.periodo === period)?.count ?? 0;
  const getPurchasesCount = (period: string) =>
    availablePeriods?.purchases?.find((p) => p.periodo === period)?.count ?? 0;

  const sortedYears = Object.keys(periodsByYear)
    .map(Number)
    .sort((a, b) => b - a);

  return (
    <div className="space-y-6">
      {/* Loading State */}
      {isLoadingPeriods && (
        <Card className="border-warning-100 bg-warning-50">
          <div className="flex items-center gap-2 p-4">
            <Spinner size="sm" />
            <Description className="text-default-700 text-sm">
              Cargando períodos disponibles...
            </Description>
          </div>
        </Card>
      )}

      {/* Error State */}
      {periodsError && (
        <Card className="border-danger-100 bg-danger-50">
          <div className="p-4">
            <span className="block font-semibold text-danger text-sm">
              Error al cargar períodos
            </span>
            <div className="mt-1">
              <Description className="text-danger text-xs">
                {periodsError instanceof Error ? periodsError.message : "Error desconocido"}
              </Description>
            </div>
            <details className="mt-2">
              <summary className="cursor-pointer font-mono text-danger text-xs">
                Respuesta del servidor
              </summary>
              <pre className="mt-1 overflow-auto rounded bg-danger-soft-hover p-2 font-mono text-danger text-xs">
                {(() => {
                  if (!(periodsError instanceof Error)) {
                    return String(periodsError);
                  }
                  if (!("details" in periodsError)) {
                    return String(periodsError);
                  }
                  const details = (periodsError as Record<string, unknown>).details;
                  return JSON.stringify(details, null, 2);
                })()}
              </pre>
            </details>
          </div>
        </Card>
      )}

      {/* Sync All Section */}
      {!isLoadingPeriods && !periodsError && availablePeriods && (
        <SyncAllCard
          isSyncingAll={isSyncingAll}
          syncAllProgress={syncAllProgress}
          availablePeriods={availablePeriods}
          onSyncAll={handleSyncAll}
        />
      )}

      {/* By Year - Scrollable Container */}
      <div className="max-h-[calc(100vh-400px)] space-y-4 overflow-y-auto pr-2">
        {sortedYears.map((year) => (
          <div key={year} className="space-y-4">
            <span className="block font-semibold text-default-700 text-lg">{year}</span>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {(periodsByYear[year] ?? []).map((period) => (
                <PeriodCard
                  key={period.period}
                  period={period}
                  lastSyncs={lastSyncs}
                  syncMutation={syncMutation}
                  onSync={handleSync}
                  hasSalesData={hasSalesData}
                  hasPurchasesData={hasPurchasesData}
                  getSalesCount={getSalesCount}
                  getPurchasesCount={getPurchasesCount}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
