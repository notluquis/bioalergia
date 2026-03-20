import {
  Alert,
  Button,
  ButtonGroup,
  Card,
  Chip,
  Description,
  Disclosure,
  Dropdown,
  Input,
  Label,
  ListBox,
  ProgressBar,
  ScrollShadow,
  Select,
  Skeleton,
  Spinner,
  Surface,
  Tabs,
  Tooltip,
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
  fetchEventDteSuggestions,
  startAutoLinkEventDteAllPeriodsJob,
  unlinkEventDteLink,
} from "@/features/calendar/api";
import { calendarDteLinkKeys, calendarDteLinkQueries } from "@/features/calendar/queries";
import type { EventDteOverviewItem, EventDteSuggestion } from "@/features/calendar/types";
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

interface KpiTileProps {
  description?: string;
  title: string;
  value: number | string;
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

function formatAutoLinkAttempt(attemptedAt: string): string {
  return dayjs(attemptedAt).format("DD-MM-YYYY HH:mm");
}

function seriesKindLabel(kind: EventDteOverviewItem["seriesKind"]): string | null {
  if (kind === "PATCH_TEST") return "Test de parche";
  if (kind === "SKIN_TEST") return "Test cutáneo";
  if (kind === "SUBCUTANEOUS_TREATMENT") return "Tratamiento subcutáneo";
  return null;
}

function describeAutoLinkSkipReason(reason: string): {
  detail: string;
  severity: "danger" | "warning";
  title: string;
  tooltipLabel: string;
} {
  const scoreMatch = /^Score bajo \((\d+)\)$/.exec(reason);
  if (scoreMatch) {
    const score = Number(scoreMatch[1] ?? 0);
    return {
      detail: `La mejor coincidencia alcanzó ${score}% y el mínimo para auto-vincular es 90%. Requiere revisión manual.`,
      severity: "warning",
      title: `Coincidencia insuficiente (${score}%)`,
      tooltipLabel: "Score insuficiente",
    };
  }

  const amountDiffMatch = /^Monto no coincide \(dif (\d+)\)$/.exec(reason);
  if (amountDiffMatch) {
    const amountDiff = Number(amountDiffMatch[1] ?? 0);
    return {
      detail: `La mejor sugerencia difiere en ${currencyFormatter.format(amountDiff)}. El auto-vínculo sólo se permite hasta ${currencyFormatter.format(5000)} de diferencia.`,
      severity: "danger",
      title: "Monto fuera del rango permitido",
      tooltipLabel: "Monto incompatible",
    };
  }

  if (reason === "Ambiguo") {
    return {
      detail:
        "Se encontraron varias sugerencias con puntaje similar. Revisa los candidatos y vincula el correcto manualmente desde esta misma tarjeta.",
      severity: "warning",
      title: "Hay más de un DTE plausible",
      tooltipLabel: "Caso ambiguo",
    };
  }

  if (reason === "Sin candidatos") {
    return {
      detail:
        "No apareció ninguna boleta o factura con coincidencia suficiente en nombre, RUT o contexto del evento.",
      severity: "danger",
      title: "No se encontró un DTE compatible",
      tooltipLabel: "Sin coincidencias",
    };
  }

  return {
    detail: reason,
    severity: "warning",
    title: "Auto-vínculo omitido",
    tooltipLabel: "Auto-link revisado",
  };
}

function suggestionMethodLabel(method: EventDteSuggestion["method"]): string {
  if (method === "mixed") return "Nombre + RUT";
  if (method === "name_exact") return "Nombre exacto";
  if (method === "name_fuzzy") return "Nombre aproximado";
  return "RUT";
}

function KpiTile({ description, title, value }: Readonly<KpiTileProps>) {
  return (
    <Surface className="rounded-2xl border border-default-200/70 p-4" variant="secondary">
      <div className="space-y-1">
        <p className="text-default-500 text-xs uppercase tracking-wide">{title}</p>
        <p className="text-2xl font-semibold leading-none tabular-nums">{value}</p>
        {description ? <Description className="text-xs">{description}</Description> : null}
      </div>
    </Surface>
  );
}

interface SuggestionExplorerProps {
  confirmPending: boolean;
  item: EventDteOverviewItem;
  onConfirm: (candidate: EventDteSuggestion) => void;
}

function SuggestionExplorer({
  confirmPending,
  item,
  onConfirm,
}: Readonly<SuggestionExplorerProps>) {
  const [isExpanded, setIsExpanded] = useState(
    item.lastAutoLinkSkip?.reason === "Ambiguo" || item.topSuggestion == null
  );

  const suggestionsQuery = useQuery({
    queryFn: () =>
      fetchEventDteSuggestions({
        calendarId: item.calendarId,
        eventId: item.eventId,
        limit: 5,
        sameDayOnly: true,
      }),
    queryKey: [
      ...calendarDteLinkKeys.suggestions(item.calendarId, item.eventId, true, 5),
      "overview",
    ],
    enabled: isExpanded && !item.linked && item.linkStatus !== "pending_issuance",
    staleTime: 60_000,
  });

  const suggestions = suggestionsQuery.data?.suggestions ?? [];
  const topCandidates = suggestions.slice(0, 3);
  const label = seriesKindLabel(item.seriesKind);

  return (
    <Disclosure isExpanded={isExpanded} onExpandedChange={setIsExpanded}>
      <Disclosure.Heading>
        <Button className="w-full justify-between rounded-2xl" slot="trigger" variant="secondary">
          <span className="flex items-center gap-2">
            <span>Candidatos revisados</span>
            {suggestions.length > 0 ? (
              <Chip color="default" size="sm" variant="soft">
                {suggestions.length}
              </Chip>
            ) : null}
          </span>
          <Disclosure.Indicator />
        </Button>
      </Disclosure.Heading>
      <Disclosure.Content>
        <Disclosure.Body className="mt-2 space-y-3 rounded-2xl border border-default-200/70 bg-default-50/50 p-3">
          {item.linkStatus === "pending_issuance" ? (
            <Alert status="warning">
              Evento futuro: los candidatos se revisan cuando llegue la fecha de emisión.
            </Alert>
          ) : null}

          {suggestionsQuery.isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-24 rounded-2xl" />
              <Skeleton className="h-24 rounded-2xl" />
            </div>
          ) : null}

          {suggestionsQuery.isError ? (
            <Alert status="danger">No se pudieron cargar los candidatos del evento.</Alert>
          ) : null}

          {!suggestionsQuery.isLoading &&
          !suggestionsQuery.isError &&
          item.linkStatus !== "pending_issuance" ? (
            <div className="space-y-3">
              {topCandidates.length > 0 ? (
                topCandidates.map((candidate, index) => {
                  const eventAmount = amountHint(item);
                  const diff =
                    eventAmount != null ? Math.abs(eventAmount - candidate.totalAmount) : null;

                  return (
                    <Surface
                      className="rounded-2xl border border-default-200/70 p-3"
                      key={candidate.dteSaleDetailId}
                      variant={index === 0 ? "secondary" : "default"}
                    >
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                        <div className="min-w-0 space-y-1">
                          <p className="truncate font-medium text-sm">{candidate.clientName}</p>
                          <Description>
                            {candidate.clientRUT} · Folio {candidate.folio} ·{" "}
                            {dayjs(candidate.documentDate).format("DD-MM-YYYY")}
                          </Description>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <Chip
                            color={scoreColor(candidate.confidenceScore)}
                            size="sm"
                            variant="soft"
                          >
                            Score {scoreLabel(candidate.confidenceScore)}
                          </Chip>
                          <Chip color="default" size="sm" variant="soft">
                            {suggestionMethodLabel(candidate.method)}
                          </Chip>
                          {label ? (
                            <Chip color="default" size="sm" variant="tertiary">
                              {label}
                            </Chip>
                          ) : null}
                        </div>
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-2 text-sm lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto]">
                        <Surface className="rounded-xl p-2.5" variant="secondary">
                          <p className="text-default-500 text-[11px] uppercase tracking-wide">
                            Monto DTE
                          </p>
                          <p className="font-medium leading-tight">
                            {currencyFormatter.format(candidate.totalAmount)}
                          </p>
                        </Surface>
                        <Surface className="rounded-xl p-2.5" variant="secondary">
                          <p className="text-default-500 text-[11px] uppercase tracking-wide">
                            Diferencia
                          </p>
                          <p className="font-medium leading-tight">
                            {diff != null ? currencyFormatter.format(diff) : "-"}
                          </p>
                        </Surface>
                        <Surface className="rounded-xl p-2.5" variant="secondary">
                          <p className="text-default-500 text-[11px] uppercase tracking-wide">
                            Registro
                          </p>
                          <p className="font-medium leading-tight">#{candidate.registerNumber}</p>
                        </Surface>
                        <Button
                          className="self-end lg:self-auto"
                          isPending={confirmPending}
                          size="sm"
                          variant={index === 0 ? "primary" : "secondary"}
                          onPress={() => onConfirm(candidate)}
                        >
                          Vincular este DTE
                        </Button>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {candidate.reasons.slice(0, 3).map((reason) => (
                          <Chip
                            key={`${candidate.dteSaleDetailId}-${reason}`}
                            size="sm"
                            variant="soft"
                          >
                            {reason}
                          </Chip>
                        ))}
                      </div>
                    </Surface>
                  );
                })
              ) : (
                <Alert status="danger">No hay candidatos disponibles para este evento.</Alert>
              )}
            </div>
          ) : null}
        </Disclosure.Body>
      </Disclosure.Content>
    </Disclosure>
  );
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

  const overviewQuery = useQuery(
    calendarDteLinkQueries.overview({
      page: search.page,
      pageSize: search.pageSize,
      period: search.period,
      query: search.query || undefined,
      status: search.status,
    })
  );

  const refetchOverview = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: calendarDteLinkKeys.all });
  }, [queryClient]);

  const autoLinkJobQuery = useQuery({
    ...calendarDteLinkQueries.autoLinkJob(activeAutoLinkJobId),
    enabled: Boolean(activeAutoLinkJobId),
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
    mutationFn: async ({
      candidate,
      item,
    }: {
      candidate: EventDteSuggestion;
      item: EventDteOverviewItem;
    }) => {
      await confirmEventDteLink({
        calendarId: item.calendarId,
        confidenceScore: candidate.confidenceScore,
        dteSaleDetailId: candidate.dteSaleDetailId,
        eventId: item.eventId,
        matchedBy: candidate.method,
        matchedName: candidate.clientName,
        matchedRUT: candidate.clientRUT,
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
        `Auto-vinculación ${result.period}: ${result.linked} vinculados, ${result.skipped} omitidos (${result.daysProcessed} días)`
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
        `Auto-vinculación iniciada: ${result.totalPeriods} períodos en lotes (concurrencia ${result.periodConcurrency}).`
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
        `Auto-vinculación completa: ${result.linked} vinculados, ${result.skipped} omitidos (${result.periodsProcessed} períodos)`
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
      <Surface
        className="rounded-[28px] border border-default-200/70 p-4 sm:p-5"
        variant="secondary"
      >
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1.4fr)] xl:items-end">
          <div className="space-y-1">
            <Card.Title>Vínculos Evento ↔ DTE</Card.Title>
            <Card.Description>
              Prioriza revisión manual en casos ambiguos o con diferencia de monto. Los eventos
              futuros siguen como pendientes de emisión.
            </Card.Description>
          </div>
          <div className="grid gap-3 lg:grid-cols-[220px_minmax(0,1fr)_auto]">
            <Select
              className="w-full"
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
                className="min-w-0 flex-1"
                placeholder="Buscar por título o descripción"
                value={queryDraft}
                onChange={(event) => setQueryDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    onSearchChange({ page: 0, query: queryDraft.trim() || undefined });
                  }
                }}
              />
              <Button
                className="shrink-0"
                variant="secondary"
                onPress={() => onSearchChange({ page: 0, query: queryDraft.trim() || undefined })}
              >
                Filtrar
              </Button>
            </div>
            <Dropdown>
              <Dropdown.Trigger>
                <Button
                  className="w-full lg:w-auto"
                  isPending={autoLinkActionPending}
                  variant="primary"
                >
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
      </Surface>

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
            <ProgressBar aria-label="Progreso de auto-vinculación" value={autoLinkProgress}>
              <ProgressBar.Track className="h-2 rounded-full bg-default-200">
                <ProgressBar.Fill className="bg-primary" />
              </ProgressBar.Track>
            </ProgressBar>
            <Description className="mt-2 text-xs">
              {autoLinkJobQuery.data.progress}/{autoLinkJobQuery.data.total} períodos procesados
            </Description>
          </Card.Content>
        </Card>
      ) : null}

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-6">
        <KpiTile title="Eventos" value={stats?.totalEvents ?? 0} />
        <KpiTile title="Vinculados" value={stats?.linkedEvents ?? 0} />
        <KpiTile title="No vinculados" value={stats?.unlinkedEvents ?? 0} />
        <KpiTile title="Pendiente emisión" value={stats?.pendingIssuanceEvents ?? 0} />
        <KpiTile
          description={`Sobre ${stats?.dueEvents ?? 0} eventos exigibles`}
          title="Tasa vinculación"
          value={`${stats?.linkRate ?? 0}%`}
        />
        <KpiTile title="Promedio score" value={Math.round(stats?.avgLinkedScore ?? 0)} />
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
                  const autoLinkSkipReason = item.lastAutoLinkSkip
                    ? describeAutoLinkSkipReason(item.lastAutoLinkSkip.reason)
                    : null;
                  const localDiff =
                    currentHint != null && displayAmount != null
                      ? Math.abs(currentHint - displayAmount)
                      : (item.topSuggestion?.amountDiff ?? null);

                  return (
                    <Card
                      className="gap-3 overflow-hidden"
                      key={`${item.calendarId}:${item.eventId}`}
                      variant="secondary"
                    >
                      <Card.Header className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                        <div className="min-w-0 space-y-1">
                          <Card.Title className="line-clamp-2 text-base">
                            {item.summary ?? "(Sin título)"}
                          </Card.Title>
                          <Card.Description>
                            {dayjs(item.eventDate).format("DD-MM-YYYY")} · {item.eventId}
                          </Card.Description>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 lg:max-w-[45%] lg:justify-end">
                          <Chip color={linkStatusColor(item.linkStatus)} variant="soft">
                            {linkStatusLabel(item.linkStatus)}
                          </Chip>
                          {item.displayName ? (
                            <Chip color="default" variant="soft" size="sm">
                              {item.displayName}
                            </Chip>
                          ) : null}
                          {item.seriesKind ? (
                            <Chip color="default" size="sm" variant="tertiary">
                              {seriesKindLabel(item.seriesKind)}
                            </Chip>
                          ) : null}
                          {item.linkStatus !== "pending_issuance" ? (
                            <Chip
                              color={scoreColor(
                                item.linked
                                  ? item.confidenceScore
                                  : (item.topSuggestion?.confidenceScore ?? null)
                              )}
                              variant="soft"
                            >
                              Score{" "}
                              {scoreLabel(
                                item.linked
                                  ? item.confidenceScore
                                  : (item.topSuggestion?.confidenceScore ?? null)
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

                      <Card.Content className="grid grid-cols-2 gap-2 text-sm lg:grid-cols-4">
                        <Surface className="rounded-xl p-3" variant="secondary">
                          <p className="text-default-500 text-[11px] uppercase tracking-wide">
                            Monto evento
                          </p>
                          <p className="font-medium leading-tight">
                            {currencyFormatter.format(currentHint ?? 0)}
                          </p>
                        </Surface>
                        <Surface className="rounded-xl p-3" variant="secondary">
                          <p className="text-default-500 text-[11px] uppercase tracking-wide">
                            {item.linked
                              ? "DTE vinculado"
                              : item.linkStatus === "pending_issuance"
                                ? "Estado DTE"
                                : "Mejor sugerencia"}
                          </p>
                          <p className="font-medium leading-tight">
                            {item.linkStatus === "pending_issuance"
                              ? "Aún no exigible"
                              : displayAmount != null
                                ? currencyFormatter.format(displayAmount)
                                : "-"}
                          </p>
                        </Surface>
                        <Surface className="rounded-xl p-3" variant="secondary">
                          <p className="text-default-500 text-[11px] uppercase tracking-wide">
                            Diferencia
                          </p>
                          <p className="font-medium leading-tight">
                            {item.linkStatus === "pending_issuance"
                              ? "-"
                              : localDiff != null
                                ? currencyFormatter.format(localDiff)
                                : "-"}
                          </p>
                        </Surface>
                        <Surface className="rounded-xl p-3" variant="secondary">
                          <p className="text-default-500 text-[11px] uppercase tracking-wide">
                            Referencia
                          </p>
                          <p className="truncate font-medium leading-tight">
                            {item.linked
                              ? `Folio ${item.linkedFolio ?? "-"}`
                              : item.topSuggestion
                                ? `Folio ${item.topSuggestion.folio}`
                                : "Sin sugerencia"}
                          </p>
                        </Surface>
                      </Card.Content>

                      {!item.linked && item.lastAutoLinkSkip ? (
                        <Card.Content className="pt-0">
                          <Alert status={autoLinkSkipReason?.severity ?? "warning"}>
                            <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                              <div className="space-y-1">
                                <p className="text-[11px] font-semibold uppercase tracking-wide">
                                  Último auto-vínculo omitido
                                </p>
                                <p className="text-sm font-medium">
                                  {autoLinkSkipReason?.title ?? item.lastAutoLinkSkip.reason}
                                </p>
                                <Description className="text-sm">
                                  {autoLinkSkipReason?.detail ?? item.lastAutoLinkSkip.reason}
                                </Description>
                                <Description className="text-xs">
                                  Intentado{" "}
                                  {formatAutoLinkAttempt(item.lastAutoLinkSkip.attemptedAt)}
                                </Description>
                              </div>
                              <Tooltip delay={0}>
                                <Tooltip.Trigger aria-label="Detalle del último intento de auto-vinculación">
                                  <Chip
                                    color={autoLinkSkipReason?.severity ?? "warning"}
                                    size="sm"
                                    variant="soft"
                                  >
                                    {autoLinkSkipReason?.tooltipLabel ?? "Auto-link revisado"}
                                  </Chip>
                                </Tooltip.Trigger>
                                <Tooltip.Content className="max-w-sm" showArrow>
                                  <Tooltip.Arrow />
                                  <div className="space-y-1">
                                    <p className="font-medium">
                                      {autoLinkSkipReason?.title ?? item.lastAutoLinkSkip.reason}
                                    </p>
                                    <p>
                                      {autoLinkSkipReason?.detail ?? item.lastAutoLinkSkip.reason}
                                    </p>
                                    <p>
                                      Último intento:{" "}
                                      {formatAutoLinkAttempt(item.lastAutoLinkSkip.attemptedAt)}
                                    </p>
                                  </div>
                                </Tooltip.Content>
                              </Tooltip>
                            </div>
                          </Alert>
                        </Card.Content>
                      ) : null}

                      {!item.linked ? (
                        <Card.Content className="pt-0">
                          <SuggestionExplorer
                            confirmPending={confirmMutation.isPending}
                            item={item}
                            onConfirm={(candidate) => confirmMutation.mutate({ item, candidate })}
                          />
                        </Card.Content>
                      ) : null}

                      <Card.Footer className="flex flex-col gap-3 border-default-200/70 border-t pt-4 lg:flex-row lg:items-center lg:justify-between">
                        <Description className="min-w-0">
                          {item.linked
                            ? `${item.linkedClientName ?? "-"} · ${item.linkedClientRUT ?? "-"} · Folio ${item.linkedFolio ?? "-"}`
                            : item.linkStatus === "pending_issuance"
                              ? "Evento en fecha futura: se revisa vínculo cuando llegue el día de emisión."
                              : item.topSuggestion
                                ? `${item.topSuggestion.clientName} · ${item.topSuggestion.clientRUT} · Folio ${item.topSuggestion.folio}`
                                : "Sin sugerencias para este evento"}
                        </Description>
                        <div className="flex w-full gap-2 lg:w-auto">
                          {item.linked ? (
                            <Button
                              className="w-full lg:w-auto"
                              isPending={unlinkMutation.isPending}
                              size="sm"
                              variant="danger"
                              onPress={() => unlinkMutation.mutate(item)}
                            >
                              Desvincular
                            </Button>
                          ) : (
                            <Button
                              className="w-full lg:w-auto"
                              isDisabled={
                                !item.topSuggestion || item.linkStatus === "pending_issuance"
                              }
                              isPending={confirmMutation.isPending}
                              size="sm"
                              variant="primary"
                              onPress={() =>
                                item.topSuggestion
                                  ? confirmMutation.mutate({
                                      item,
                                      candidate: item.topSuggestion,
                                    })
                                  : undefined
                              }
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
