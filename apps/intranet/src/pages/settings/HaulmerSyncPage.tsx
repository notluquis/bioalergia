import {
  Button,
  Card,
  Checkbox,
  Chip,
  Description,
  Label,
  Modal,
  Skeleton,
  Spinner,
} from "@heroui/react";
import { useMutation, useQuery } from "@tanstack/react-query";
import dayjs from "dayjs";
import localeEs from "dayjs/locale/es";
import { Check, Download, RefreshCw, X } from "lucide-react";
import { useMemo, useState } from "react";
import { z } from "zod";

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

interface SyncAllProgressState {
  current: number;
  currentDocType: null | "purchases" | "sales";
  currentPeriod: null | string;
  failed: number;
  isOpen: boolean;
  success: number;
  total: number;
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
  isSyncingIncremental: boolean;
  availablePeriods: AvailablePeriodsData | undefined;
  onOpenSyncModal: () => void;
  onSyncIncremental: () => void;
}

function SyncAllCard({
  isSyncingAll,
  isSyncingIncremental,
  availablePeriods,
  onOpenSyncModal,
  onSyncIncremental,
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
      <div className="space-y-3 p-3">
        <div className="flex items-center justify-between">
          <div>
            <span className="block font-semibold text-default-700">Sincronización Masiva</span>
            <div className="mt-0.5">
              <Description className="text-default-500 text-sm">
                Datos disponibles: {availablePeriods.sales.length} períodos de ventas +{" "}
                {availablePeriods.purchases.length} períodos de compras
              </Description>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              isDisabled={isSyncingAll || isSyncingIncremental}
              isPending={isSyncingAll}
              onPress={onOpenSyncModal}
              variant="primary"
            >
              {!isSyncingAll ? <Download className="h-4 w-4" /> : null}
              {isSyncingAll ? "Sincronizando..." : "Sincronizar"}
            </Button>
            <Button
              isDisabled={isSyncingAll || isSyncingIncremental}
              isPending={isSyncingIncremental}
              onPress={onSyncIncremental}
              variant="secondary"
            >
              {!isSyncingIncremental ? <RefreshCw className="h-4 w-4" /> : null}
              {isSyncingIncremental ? "Sincronizando..." : "Incremental"}
            </Button>
          </div>
        </div>
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
      <div className="gap-3 space-y-3 p-3">
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
        <div className="space-y-1.5 border-default-100 border-t pt-2.5">
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
            isDisabled={
              !hasSalesData(period.period) ||
              (syncMutation.isPending && syncMutation.variables?.period === period.period)
            }
            size="sm"
            variant="primary"
            onPress={() => {
              onSync(period.period, "sales");
            }}
          >
            <Download className="h-4 w-4" />
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
        <div className="space-y-1.5 border-default-100 border-t pt-2.5">
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
            isDisabled={
              !hasPurchasesData(period.period) ||
              (syncMutation.isPending && syncMutation.variables?.period === period.period)
            }
            size="sm"
            variant="primary"
            onPress={() => {
              onSync(period.period, "purchases");
            }}
          >
            <Download className="h-4 w-4" />
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
  const [isSyncingAll, setIsSyncingAll] = useState(false);
  const [isSyncingIncremental, setIsSyncingIncremental] = useState(false);
  const [isSyncScopeModalOpen, setIsSyncScopeModalOpen] = useState(false);
  const [syncSalesSelected, setSyncSalesSelected] = useState(true);
  const [syncPurchasesSelected, setSyncPurchasesSelected] = useState(true);
  const [syncAllProgress, setSyncAllProgress] = useState<SyncAllProgressState>({
    current: 0,
    currentDocType: null,
    currentPeriod: null,
    failed: 0,
    isOpen: false,
    success: 0,
    total: 0,
  });

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
        { responseSchema: SyncResponseSchema, timeout: false },
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

  const handleSyncAll = async (docTypes: Array<"sales" | "purchases">) => {
    const includeSales = docTypes.includes("sales");
    const includePurchases = docTypes.includes("purchases");
    const salesPeriods = includeSales
      ? (availablePeriods?.sales ?? []).map((item) => item.periodo)
      : [];
    const purchasesPeriods = includePurchases
      ? (availablePeriods?.purchases ?? []).map((item) => item.periodo)
      : [];
    const tasks: Array<{ docType: "purchases" | "sales"; period: string }> = [
      ...salesPeriods.map((period) => ({ period, docType: "sales" as const })),
      ...purchasesPeriods.map((period) => ({ period, docType: "purchases" as const })),
    ];

    if (tasks.length === 0) {
      showSuccess("No hay períodos disponibles para sincronizar");
      return;
    }

    setIsSyncingAll(true);
    setSyncAllProgress({
      current: 0,
      currentDocType: null,
      currentPeriod: null,
      failed: 0,
      isOpen: true,
      success: 0,
      total: tasks.length,
    });

    try {
      let successCount = 0;
      let failedCount = 0;
      for (const [index, task] of tasks.entries()) {
        setSyncAllProgress((prev) => ({
          ...prev,
          current: index + 1,
          currentDocType: task.docType,
          currentPeriod: task.period,
        }));

        try {
          const response = await apiClient.post<z.infer<typeof SyncResponseSchema>>(
            "/api/haulmer/sync",
            {
              periods: [task.period],
              docTypes: [task.docType],
            },
            { responseSchema: SyncResponseSchema, timeout: false },
          );

          const result = response.results?.[0];
          if (result) {
            const key = `${result.period}-${result.docType}`;
            setLastSyncs((prev) => ({
              ...prev,
              [key]: result,
            }));
            if (result.status === "success") {
              successCount += 1;
            } else {
              failedCount += 1;
            }
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : "Error desconocido";
          failedCount += 1;
          const key = `${task.period}-${task.docType}`;
          setLastSyncs((prev) => ({
            ...prev,
            [key]: {
              docType: task.docType,
              error: message,
              period: task.period,
              rowsInserted: 0,
              rowsProcessed: 0,
              rowsUpdated: 0,
              status: "failed",
            },
          }));
        }

        setSyncAllProgress((prev) => ({
          ...prev,
          failed: failedCount,
          success: successCount,
        }));
      }

      showSuccess(`Sync total completado: ${successCount} OK, ${failedCount} con error`);
    } catch (error) {
      showError(
        `Error durante sincronización total: ${error instanceof Error ? error.message : "Desconocido"}`,
      );
    } finally {
      setIsSyncingAll(false);
      setSyncAllProgress((prev) => ({
        ...prev,
        currentDocType: null,
        currentPeriod: null,
        isOpen: false,
      }));
    }
  };

  const handleOpenSyncScopeModal = () => {
    setSyncSalesSelected(true);
    setSyncPurchasesSelected(true);
    setIsSyncScopeModalOpen(true);
  };

  const handleConfirmSyncScope = () => {
    const docTypes: Array<"sales" | "purchases"> = [];
    if (syncSalesSelected) {
      docTypes.push("sales");
    }
    if (syncPurchasesSelected) {
      docTypes.push("purchases");
    }
    if (docTypes.length === 0) {
      return;
    }

    setIsSyncScopeModalOpen(false);
    void handleSyncAll(docTypes);
  };

  const handleSyncIncremental = async () => {
    const message =
      "¿Sincronizar incremental? Se traerán solo períodos nuevos y el más reciente para refresco.";
    if (!confirm(message)) {
      return;
    }

    setIsSyncingIncremental(true);

    try {
      const response = await apiClient.post<z.infer<typeof SyncResponseSchema>>(
        "/api/haulmer/sync/incremental",
        {
          docTypes: ["sales", "purchases"],
          includeLatestAlreadySynced: true,
        },
        { responseSchema: SyncResponseSchema, timeout: false },
      );

      for (const result of response.results ?? []) {
        const key = `${result.period}-${result.docType}`;
        setLastSyncs((prev) => ({
          ...prev,
          [key]: result,
        }));
      }

      if ((response.summary?.total ?? 0) === 0) {
        showSuccess("No hay períodos nuevos para sincronizar");
      } else {
        showSuccess(
          `Sync incremental completado: ${response.summary.success} OK, ${response.summary.failed} con error`,
        );
      }
    } catch (error) {
      showError(
        `Error durante sincronización incremental: ${error instanceof Error ? error.message : "Desconocido"}`,
      );
    } finally {
      setIsSyncingIncremental(false);
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
    <div className="space-y-4">
      {/* Loading State */}
      {isLoadingPeriods && (
        <Card className="border-warning-100 bg-warning-50">
          <div className="space-y-1.5 p-3">
            <Skeleton className="h-4 w-56 rounded-md" />
            <Skeleton className="h-3 w-40 rounded-md" />
          </div>
        </Card>
      )}

      {/* Error State */}
      {periodsError && (
        <Card className="border-danger-100 bg-danger-50">
          <div className="p-3">
            <span className="block font-semibold text-danger text-sm">
              Error al cargar períodos
            </span>
            <div className="mt-0.5">
              <Description className="text-danger text-xs">
                {periodsError instanceof Error ? periodsError.message : "Error desconocido"}
              </Description>
            </div>
            <details className="mt-1.5">
              <summary className="cursor-pointer font-mono text-danger text-xs">
                Respuesta del servidor
              </summary>
              <pre className="mt-1 overflow-auto rounded bg-danger-soft-hover p-1.5 font-mono text-danger text-xs">
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
          isSyncingIncremental={isSyncingIncremental}
          availablePeriods={availablePeriods}
          onOpenSyncModal={handleOpenSyncScopeModal}
          onSyncIncremental={handleSyncIncremental}
        />
      )}

      {/* By Year - Scrollable Container */}
      <div className="max-h-[calc(100vh-400px)] space-y-3 overflow-y-auto pr-1">
        {sortedYears.map((year) => (
          <div key={year} className="space-y-3">
            <span className="block font-semibold text-default-700 text-lg">{year}</span>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
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

      <Modal>
        <Modal.Backdrop
          isOpen={isSyncScopeModalOpen}
          onOpenChange={(open) => {
            setIsSyncScopeModalOpen(open);
          }}
        >
          <Modal.Container placement="center">
            <Modal.Dialog className="w-full max-w-lg">
              <Modal.CloseTrigger />
              <Modal.Header>
                <Modal.Heading>Configurar sincronización</Modal.Heading>
              </Modal.Header>
              <Modal.Body className="space-y-4">
                <Description className="text-default-600 text-sm">
                  Elige si quieres sincronizar todo, solo ventas o solo compras. Marcando ambas
                  opciones se ejecuta sincronización completa.
                </Description>

                <div className="space-y-2 rounded-lg border border-default-200 p-3">
                  <Checkbox
                    id="sync-sales-checkbox"
                    className="w-full rounded-md px-2 py-2 hover:bg-default-50"
                    isSelected={syncSalesSelected}
                    onChange={setSyncSalesSelected}
                    variant="secondary"
                  >
                    <Checkbox.Control>
                      <Checkbox.Indicator />
                    </Checkbox.Control>
                    <Checkbox.Content>
                      <Label className="cursor-pointer" htmlFor="sync-sales-checkbox">
                        Ventas
                      </Label>
                    </Checkbox.Content>
                  </Checkbox>
                  <Checkbox
                    id="sync-purchases-checkbox"
                    className="w-full rounded-md px-2 py-2 hover:bg-default-50"
                    isSelected={syncPurchasesSelected}
                    onChange={setSyncPurchasesSelected}
                    variant="secondary"
                  >
                    <Checkbox.Control>
                      <Checkbox.Indicator />
                    </Checkbox.Control>
                    <Checkbox.Content>
                      <Label className="cursor-pointer" htmlFor="sync-purchases-checkbox">
                        Compras
                      </Label>
                    </Checkbox.Content>
                  </Checkbox>
                </div>
              </Modal.Body>
              <Modal.Footer className="gap-2">
                <Button
                  onPress={() => {
                    setIsSyncScopeModalOpen(false);
                  }}
                  variant="secondary"
                >
                  Cancelar
                </Button>
                <Button
                  isDisabled={!syncSalesSelected && !syncPurchasesSelected}
                  isPending={isSyncingAll}
                  onPress={handleConfirmSyncScope}
                  variant="primary"
                >
                  Sincronizar seleccionado
                </Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>

      <Modal>
        <Modal.Backdrop
          isDismissable={false}
          isKeyboardDismissDisabled
          isOpen={syncAllProgress.isOpen}
          onOpenChange={() => {}}
          variant="blur"
        >
          <Modal.Container placement="center">
            <Modal.Dialog className="w-full max-w-md">
              <Modal.Header>
                <Modal.Heading>Sincronizando Haulmer</Modal.Heading>
              </Modal.Header>
              <Modal.Body className="space-y-3">
                <div className="flex items-center gap-2 text-default-600 text-sm">
                  <Spinner size="sm" />
                  <span>
                    {syncAllProgress.current}/{syncAllProgress.total} •{" "}
                    {syncAllProgress.currentDocType == null
                      ? "Preparando..."
                      : `${syncAllProgress.currentDocType === "sales" ? "Ventas" : "Compras"} ${syncAllProgress.currentPeriod ?? ""}`}
                  </span>
                </div>

                <div className="h-2 overflow-hidden rounded-full bg-default-100">
                  <div
                    className="h-full bg-primary "
                    style={{
                      width: `${
                        syncAllProgress.total > 0
                          ? Math.round((syncAllProgress.current / syncAllProgress.total) * 100)
                          : 0
                      }%`,
                    }}
                  />
                </div>

                <Description className="text-default-500 text-xs">
                  Progreso:{" "}
                  {syncAllProgress.total > 0
                    ? Math.round((syncAllProgress.current / syncAllProgress.total) * 100)
                    : 0}
                  % • OK: {syncAllProgress.success} • Error: {syncAllProgress.failed}
                </Description>
              </Modal.Body>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>
    </div>
  );
}
