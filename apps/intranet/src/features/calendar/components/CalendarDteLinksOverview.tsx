import {
  Button,
  ButtonGroup,
  Card,
  Chip,
  Description,
  Dropdown,
  Input,
  Label,
  ListBox,
  ScrollShadow,
  Select,
  Skeleton,
  Spinner,
  Tabs,
} from "@heroui/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";
import "dayjs/locale/es";
import { ChevronDown } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useToast } from "@/context/ToastContext";
import {
  autoLinkEventDteByPeriod,
  confirmEventDteLink,
  fetchAutoLinkEventDteJobStatus,
  fetchEventDteLinksOverview,
  startAutoLinkEventDteAllPeriodsJob,
  unlinkEventDteLink,
} from "@/features/calendar/api";
import type { EventDteOverviewItem } from "@/features/calendar/types";
import { currencyFormatter } from "@/lib/format";

const OVERVIEW_SKELETON_KEYS = [
  "overview-skeleton-1",
  "overview-skeleton-2",
  "overview-skeleton-3",
  "overview-skeleton-4",
  "overview-skeleton-5",
  "overview-skeleton-6",
] as const;

export type LinkStatusFilter = "all" | "linked" | "pending_issuance" | "unlinked";

export interface CalendarDteLinksSearchState {
  page: number;
  pageSize: number;
  period: string;
  query?: string;
  status: LinkStatusFilter;
}

interface CalendarDteLinksOverviewProps {
  onSearchChange: (next: Partial<CalendarDteLinksSearchState>) => void;
  search: CalendarDteLinksSearchState;
}

type AutoLinkMode = "all_periods" | "selected_period";
interface AutoLinkRunSummary {
  linked: number;
  modeLabel: string;
  processedLabel: string;
  skipped: number;
  skippedByReason: Array<{ count: number; reason: string }>;
}

function buildPeriodOptions(count = 24): Array<{ label: string; value: string }> {
  dayjs.locale("es");
  return Array.from({ length: count }, (_, index) => {
    const period = dayjs().subtract(index, "month");
    return {
      label: period.format("MMMM YYYY"),
      value: period.format("YYYY-MM"),
    };
  });
}

function scoreColor(score: null | number): "danger" | "success" | "warning" {
  if (score == null) return "warning";
  if (score >= 90) return "success";
  if (score >= 70) return "warning";
  return "danger";
}

function scoreLabel(score: null | number): string {
  if (score == null) return "-";
  return `${Math.round(score)}%`;
}

function amountHint(item: EventDteOverviewItem): null | number {
  if (item.amountPaid != null && Number.isFinite(item.amountPaid)) {
    return item.amountPaid;
  }
  if (item.amountExpected != null && Number.isFinite(item.amountExpected)) {
    return item.amountExpected;
  }
  return null;
}

function linkStatusColor(status: EventDteOverviewItem["linkStatus"]): "success" | "warning" {
  if (status === "linked") return "success";
  return "warning";
}

function linkStatusLabel(status: EventDteOverviewItem["linkStatus"]): string {
  if (status === "linked") return "Vinculado";
  if (status === "pending_issuance") return "Pendiente emisión";
  return "No vinculado";
}

export function CalendarDteLinksOverview({
  onSearchChange,
  search,
}: CalendarDteLinksOverviewProps) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [queryDraft, setQueryDraft] = useState(search.query ?? "");
  const [autoLinkSummary, setAutoLinkSummary] = useState<AutoLinkRunSummary | null>(null);
  const [activeAutoLinkJobId, setActiveAutoLinkJobId] = useState<null | string>(null);

  useEffect(() => {
    setQueryDraft(search.query ?? "");
  }, [search.query]);

  const overviewQuery = useQuery({
    queryFn: () =>
      fetchEventDteLinksOverview({
        page: search.page,
        pageSize: search.pageSize,
        period: search.period,
        query: search.query || undefined,
        status: search.status,
      }),
    queryKey: [
      "calendar",
      "dte-link",
      "overview",
      search.period,
      search.status,
      search.page,
      search.pageSize,
      search.query ?? "",
    ],
  });

  const refetchOverview = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ["calendar", "dte-link", "overview"] });
  }, [queryClient]);

  const autoLinkJobQuery = useQuery({
    enabled: Boolean(activeAutoLinkJobId),
    queryFn: () => fetchAutoLinkEventDteJobStatus(activeAutoLinkJobId ?? ""),
    queryKey: ["calendar", "dte-link", "auto-link-job", activeAutoLinkJobId],
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (status === "completed" || status === "failed") {
        return false;
      }
      return activeAutoLinkJobId ? 1000 : false;
    },
    staleTime: 0,
  });

  const confirmMutation = useMutation({
    mutationFn: async (item: EventDteOverviewItem) => {
      if (!item.topSuggestion) {
        throw new Error("No hay sugerencia para vincular");
      }
      await confirmEventDteLink({
        calendarId: item.calendarId,
        confidenceScore: item.topSuggestion.confidenceScore,
        dteSaleDetailId: item.topSuggestion.dteSaleDetailId,
        eventId: item.eventId,
        matchedBy: item.topSuggestion.method,
        matchedName: item.topSuggestion.clientName,
        matchedRUT: item.topSuggestion.clientRUT,
      });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "No se pudo vincular");
    },
    onSuccess: async () => {
      toast.success("Vínculo confirmado");
      await refetchOverview();
    },
  });

  const unlinkMutation = useMutation({
    mutationFn: async (item: EventDteOverviewItem) => {
      await unlinkEventDteLink({
        calendarId: item.calendarId,
        eventId: item.eventId,
      });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "No se pudo desvincular");
    },
    onSuccess: async () => {
      toast.success("Vínculo eliminado");
      await refetchOverview();
    },
  });

  const autoLinkPeriodMutation = useMutation({
    mutationFn: async () => autoLinkEventDteByPeriod({ period: search.period }),
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "No se pudo auto-vincular");
    },
    onSuccess: async (result) => {
      setAutoLinkSummary({
        linked: result.linked,
        modeLabel: `Período ${result.period}`,
        processedLabel: `${result.daysProcessed} días`,
        skipped: result.skipped,
        skippedByReason: result.skippedByReason,
      });
      toast.success(
        `Auto-vinculación ${result.period}: ${result.linked} vinculados, ${result.skipped} omitidos (${result.daysProcessed} días)`,
      );
      await refetchOverview();
    },
  });

  const startAutoLinkAllPeriodsMutation = useMutation({
    mutationFn: () => startAutoLinkEventDteAllPeriodsJob({ periodConcurrency: 3 }),
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "No se pudo iniciar auto-vinculación");
    },
    onSuccess: (result) => {
      setActiveAutoLinkJobId(result.jobId);
      toast.info(
        `Auto-vinculación iniciada: ${result.totalPeriods} períodos en lotes (concurrencia ${result.periodConcurrency}).`,
      );
    },
  });

  useEffect(() => {
    const job = autoLinkJobQuery.data;
    if (!job || !activeAutoLinkJobId) {
      return;
    }
    if (job.status === "completed") {
      const result = job.result as {
        linked: number;
        periodsProcessed: number;
        skipped: number;
        skippedByReason: Array<{ count: number; reason: string }>;
      };
      setAutoLinkSummary({
        linked: result.linked,
        modeLabel: "Todos los períodos",
        processedLabel: `${result.periodsProcessed} períodos`,
        skipped: result.skipped,
        skippedByReason: result.skippedByReason ?? [],
      });
      toast.success(
        `Auto-vinculación completa: ${result.linked} vinculados, ${result.skipped} omitidos (${result.periodsProcessed} períodos)`,
      );
      setActiveAutoLinkJobId(null);
      void refetchOverview();
      return;
    }
    if (job.status === "failed") {
      toast.error(job.error ?? "Falló la auto-vinculación");
      setActiveAutoLinkJobId(null);
    }
  }, [activeAutoLinkJobId, autoLinkJobQuery.data, toast, refetchOverview]);

  const isAutoLinkRunning = Boolean(activeAutoLinkJobId) && !autoLinkJobQuery.isError;
  const autoLinkProgress = autoLinkJobQuery.data
    ? Math.round((autoLinkJobQuery.data.progress / Math.max(autoLinkJobQuery.data.total, 1)) * 100)
    : 0;
  const autoLinkActionPending =
    autoLinkPeriodMutation.isPending || startAutoLinkAllPeriodsMutation.isPending;

  const periodOptions = useMemo(() => buildPeriodOptions(30), []);
  const stats = overviewQuery.data?.stats;
  const items = overviewQuery.data?.items ?? [];

  return (
    <div className="space-y-4">
      <Card>
        <Card.Header className="flex flex-col items-start gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <Card.Title>Vínculos Evento ↔ DTE</Card.Title>
            <Card.Description>
              Los no vinculados se cuentan solo hasta hoy. Eventos futuros quedan como pendientes de
              emisión.
            </Card.Description>
          </div>
          <div className="flex w-full flex-col gap-2 sm:flex-row lg:w-auto">
            <Select
              className="w-full sm:w-56"
              value={search.period}
              onChange={(value) =>
                onSearchChange({
                  page: 0,
                  period: value ? String(value) : dayjs().format("YYYY-MM"),
                })
              }
            >
              <Label>Periodo</Label>
              <Select.Trigger>
                <Select.Value />
                <Select.Indicator />
              </Select.Trigger>
              <Select.Popover>
                <ListBox>
                  {periodOptions.map((option) => (
                    <ListBox.Item id={option.value} key={option.value} textValue={option.label}>
                      {option.label}
                      <ListBox.ItemIndicator />
                    </ListBox.Item>
                  ))}
                </ListBox>
              </Select.Popover>
            </Select>
            <div className="flex gap-2">
              <Input
                className="min-w-60"
                placeholder="Buscar por título/descripción"
                value={queryDraft}
                onChange={(event) => setQueryDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    onSearchChange({ page: 0, query: queryDraft.trim() || undefined });
                  }
                }}
              />
              <Button
                variant="secondary"
                onPress={() => onSearchChange({ page: 0, query: queryDraft.trim() || undefined })}
              >
                Filtrar
              </Button>
              <Dropdown>
                <Dropdown.Trigger>
                  <Button isPending={autoLinkActionPending} variant="primary">
                    Auto-vincular
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </Dropdown.Trigger>
                <Dropdown.Popover className="min-w-75" placement="bottom end">
                  <Dropdown.Menu
                    aria-label="Opciones de auto-vinculación"
                    onAction={(key) => {
                      const mode = String(key) as AutoLinkMode;
                      if (mode === "all_periods") {
                        startAutoLinkAllPeriodsMutation.mutate();
                        return;
                      }
                      autoLinkPeriodMutation.mutate();
                    }}
                  >
                    <Dropdown.Item
                      id="selected_period"
                      isDisabled={autoLinkActionPending || isAutoLinkRunning}
                      textValue={`Solo período seleccionado (${search.period})`}
                    >
                      <Label>Solo período seleccionado ({search.period})</Label>
                    </Dropdown.Item>
                    <Dropdown.Item
                      id="all_periods"
                      isDisabled={autoLinkActionPending || isAutoLinkRunning}
                      textValue="Todos los períodos disponibles (hasta hoy)"
                    >
                      <Label>Todos los períodos disponibles (hasta hoy)</Label>
                    </Dropdown.Item>
                  </Dropdown.Menu>
                </Dropdown.Popover>
              </Dropdown>
            </div>
          </div>
        </Card.Header>
      </Card>

      {isAutoLinkRunning && autoLinkJobQuery.data ? (
        <Card variant="secondary">
          <Card.Header className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <Card.Title className="text-sm">Auto-vinculación en progreso</Card.Title>
              <Card.Description>{autoLinkJobQuery.data.message}</Card.Description>
            </div>
            <div className="inline-flex items-center gap-2">
              <Spinner size="sm" />
              <Description className="font-medium tabular-nums">{autoLinkProgress}%</Description>
            </div>
          </Card.Header>
          <Card.Content>
            <div className="h-2 w-full overflow-hidden rounded-full bg-default-200">
              <div
                className="h-full rounded-full bg-primary "
                style={{ width: `${autoLinkProgress}%` }}
              />
            </div>
            <Description className="mt-2 text-xs">
              {autoLinkJobQuery.data.progress}/{autoLinkJobQuery.data.total} períodos procesados
            </Description>
          </Card.Content>
        </Card>
      ) : null}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
        <Card variant="secondary">
          <Card.Header>
            <Card.Title className="text-sm">Eventos</Card.Title>
            <Card.Description className="text-2xl font-semibold">
              {stats?.totalEvents ?? 0}
            </Card.Description>
          </Card.Header>
        </Card>
        <Card variant="secondary">
          <Card.Header>
            <Card.Title className="text-sm">Vinculados</Card.Title>
            <Card.Description className="text-2xl font-semibold">
              {stats?.linkedEvents ?? 0}
            </Card.Description>
          </Card.Header>
        </Card>
        <Card variant="secondary">
          <Card.Header>
            <Card.Title className="text-sm">No Vinculados (Hasta Hoy)</Card.Title>
            <Card.Description className="text-2xl font-semibold">
              {stats?.unlinkedEvents ?? 0}
            </Card.Description>
          </Card.Header>
        </Card>
        <Card variant="secondary">
          <Card.Header>
            <Card.Title className="text-sm">Pendiente Emisión</Card.Title>
            <Card.Description className="text-2xl font-semibold">
              {stats?.pendingIssuanceEvents ?? 0}
            </Card.Description>
          </Card.Header>
        </Card>
        <Card variant="secondary">
          <Card.Header>
            <Card.Title className="text-sm">Tasa Vinculación (Hasta Hoy)</Card.Title>
            <Card.Description className="text-2xl font-semibold">
              {stats?.linkRate ?? 0}%
            </Card.Description>
            <Description className="text-default-500 text-xs">
              Sobre {stats?.dueEvents ?? 0} eventos exigibles
            </Description>
          </Card.Header>
        </Card>
        <Card variant="secondary">
          <Card.Header>
            <Card.Title className="text-sm">Promedio Score</Card.Title>
            <Card.Description className="text-2xl font-semibold">
              {Math.round(stats?.avgLinkedScore ?? 0)}
            </Card.Description>
          </Card.Header>
        </Card>
      </div>

      {autoLinkSummary ? (
        <Card variant="secondary">
          <Card.Header>
            <Card.Title className="text-sm">Resultado última auto-vinculación</Card.Title>
            <Card.Description>
              {autoLinkSummary.modeLabel} · {autoLinkSummary.processedLabel} ·{" "}
              {autoLinkSummary.linked} vinculados · {autoLinkSummary.skipped} omitidos
            </Card.Description>
          </Card.Header>
          <Card.Content className="flex flex-wrap gap-2">
            {autoLinkSummary.skippedByReason.length > 0 ? (
              autoLinkSummary.skippedByReason.map((entry) => (
                <Chip key={entry.reason} variant="soft">
                  {entry.reason}: {entry.count}
                </Chip>
              ))
            ) : (
              <Description>Sin omitidos en esta ejecución.</Description>
            )}
          </Card.Content>
        </Card>
      ) : null}

      <Card>
        <Card.Header className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <Tabs
            selectedKey={search.status}
            onSelectionChange={(key) =>
              onSearchChange({ page: 0, status: String(key) as LinkStatusFilter })
            }
          >
            <Tabs.ListContainer>
              <Tabs.List aria-label="Filtro de estado" className="w-fit">
                <Tabs.Tab id="all">
                  Todos (sin pendientes)
                  <Tabs.Indicator />
                </Tabs.Tab>
                <Tabs.Tab id="linked">
                  Vinculados
                  <Tabs.Separator />
                  <Tabs.Indicator />
                </Tabs.Tab>
                <Tabs.Tab id="unlinked">
                  No vinculados (hasta hoy)
                  <Tabs.Separator />
                  <Tabs.Indicator />
                </Tabs.Tab>
                <Tabs.Tab id="pending_issuance">
                  Pendiente emisión
                  <Tabs.Separator />
                  <Tabs.Indicator />
                </Tabs.Tab>
              </Tabs.List>
            </Tabs.ListContainer>
          </Tabs>
          <Description>
            Página {search.page + 1} de {overviewQuery.data?.totalPages ?? 1} ·{" "}
            {overviewQuery.data?.totalCount ?? 0} filas
          </Description>
        </Card.Header>
        <Card.Content className="p-0">
          {overviewQuery.isLoading ? (
            <div className="space-y-2 p-4">
              {OVERVIEW_SKELETON_KEYS.map((key) => (
                <Skeleton className="h-24 rounded-xl" key={key} />
              ))}
            </div>
          ) : null}

          {overviewQuery.isError ? (
            <div className="p-4">
              <Description className="text-danger">No se pudo cargar el overview.</Description>
            </div>
          ) : null}

          {!overviewQuery.isLoading && !overviewQuery.isError ? (
            <ScrollShadow className="max-h-[64dvh] p-4" size={80}>
              <div className="space-y-3">
                {items.length === 0 ? (
                  <Card variant="transparent">
                    <Card.Header>
                      <Card.Title className="text-base">Sin resultados</Card.Title>
                      <Card.Description>Ajusta los filtros o prueba otro período.</Card.Description>
                    </Card.Header>
                  </Card>
                ) : null}

                {items.map((item) => {
                  const displayAmount = item.linked
                    ? item.linkedTotalAmount
                    : (item.topSuggestion?.totalAmount ?? null);
                  const currentHint = amountHint(item);
                  const localDiff =
                    currentHint != null && displayAmount != null
                      ? Math.abs(currentHint - displayAmount)
                      : (item.topSuggestion?.amountDiff ?? null);

                  return (
                    <Card
                      className="gap-2"
                      key={`${item.calendarId}:${item.eventId}`}
                      variant="secondary"
                    >
                      <Card.Header className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                        <div className="space-y-1">
                          <Card.Title className="text-base">
                            {item.summary ?? "(Sin título)"}
                          </Card.Title>
                          <Card.Description>
                            {dayjs(item.eventDate).format("DD-MM-YYYY")} · {item.eventId}
                          </Card.Description>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <Chip color={linkStatusColor(item.linkStatus)} variant="soft">
                            {linkStatusLabel(item.linkStatus)}
                          </Chip>
                          {item.linkStatus !== "pending_issuance" ? (
                            <Chip
                              color={scoreColor(
                                item.linked
                                  ? item.confidenceScore
                                  : (item.topSuggestion?.confidenceScore ?? null),
                              )}
                              variant="soft"
                            >
                              Score{" "}
                              {scoreLabel(
                                item.linked
                                  ? item.confidenceScore
                                  : (item.topSuggestion?.confidenceScore ?? null),
                              )}
                            </Chip>
                          ) : null}
                          {item.linked && (item.confidenceScore ?? 0) === 100 ? (
                            <Chip color="success" variant="soft">
                              Perfecto 100
                            </Chip>
                          ) : null}
                        </div>
                      </Card.Header>

                      <Card.Content className="grid grid-cols-1 gap-2 text-sm lg:grid-cols-3">
                        <div className="rounded-lg border border-default-200 p-2">
                          <p className="text-default-500 text-xs uppercase">Monto evento</p>
                          <p className="font-medium">
                            {currencyFormatter.format(currentHint ?? 0)}
                          </p>
                        </div>
                        <div className="rounded-lg border border-default-200 p-2">
                          <p className="text-default-500 text-xs uppercase">
                            {item.linked
                              ? "DTE vinculado"
                              : item.linkStatus === "pending_issuance"
                                ? "Estado DTE"
                                : "Mejor sugerencia"}
                          </p>
                          <p className="font-medium">
                            {item.linkStatus === "pending_issuance"
                              ? "Aún no exigible"
                              : displayAmount != null
                                ? currencyFormatter.format(displayAmount)
                                : "-"}
                          </p>
                        </div>
                        <div className="rounded-lg border border-default-200 p-2">
                          <p className="text-default-500 text-xs uppercase">Diferencia</p>
                          <p className="font-medium">
                            {item.linkStatus === "pending_issuance"
                              ? "-"
                              : localDiff != null
                                ? currencyFormatter.format(localDiff)
                                : "-"}
                          </p>
                        </div>
                      </Card.Content>

                      <Card.Footer className="flex flex-col items-start justify-between gap-2 md:flex-row md:items-center">
                        <Description>
                          {item.linked
                            ? `${item.linkedClientName ?? "-"} · ${item.linkedClientRUT ?? "-"} · Folio ${item.linkedFolio ?? "-"}`
                            : item.linkStatus === "pending_issuance"
                              ? "Evento en fecha futura: se revisa vínculo cuando llegue el día de emisión."
                              : item.topSuggestion
                                ? `${item.topSuggestion.clientName} · ${item.topSuggestion.clientRUT} · Folio ${item.topSuggestion.folio}`
                                : "Sin sugerencias para este evento"}
                        </Description>
                        <div className="flex gap-2">
                          {item.linked ? (
                            <Button
                              isPending={unlinkMutation.isPending}
                              size="sm"
                              variant="danger"
                              onPress={() => unlinkMutation.mutate(item)}
                            >
                              Desvincular
                            </Button>
                          ) : (
                            <Button
                              isDisabled={
                                !item.topSuggestion || item.linkStatus === "pending_issuance"
                              }
                              isPending={confirmMutation.isPending}
                              size="sm"
                              variant="primary"
                              onPress={() => confirmMutation.mutate(item)}
                            >
                              Vincular sugerencia
                            </Button>
                          )}
                        </div>
                      </Card.Footer>
                    </Card>
                  );
                })}
              </div>
            </ScrollShadow>
          ) : null}
        </Card.Content>
        <Card.Footer className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <Description>Perfect score 100: {stats?.withPerfectScore ?? 0}</Description>
          <ButtonGroup size="sm" variant="secondary">
            <Button
              isDisabled={search.page <= 0 || overviewQuery.isFetching}
              onPress={() => onSearchChange({ page: Math.max(0, search.page - 1) })}
            >
              Anterior
            </Button>
            <Button isDisabled>
              {overviewQuery.isFetching ? (
                <span className="inline-flex items-center gap-2">
                  <Spinner size="sm" /> Cargando
                </span>
              ) : (
                `Página ${search.page + 1}/${overviewQuery.data?.totalPages ?? 1}`
              )}
            </Button>
            <Button
              isDisabled={
                overviewQuery.isFetching || search.page + 1 >= (overviewQuery.data?.totalPages ?? 1)
              }
              onPress={() => onSearchChange({ page: search.page + 1 })}
            >
              Siguiente
            </Button>
          </ButtonGroup>
        </Card.Footer>
      </Card>
    </div>
  );
}
