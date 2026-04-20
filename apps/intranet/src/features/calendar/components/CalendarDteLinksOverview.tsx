import {
  Accordion,
  Alert,
  Button,
  ButtonGroup,
  Card,
  Chip,
  Description,
  Disclosure,
  Dropdown,
  Label,
  ListBox,
  ProgressBar,
  SearchField,
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
import type {
  EventDteMatchHypothesis,
  EventDteOverviewItem,
  EventDteSuggestion,
} from "@/features/calendar/types";
import { currencyFormatter } from "@/lib/format";

const OVERVIEW_SKELETON_KEYS = [
  "overview-skeleton-1",
  "overview-skeleton-2",
  "overview-skeleton-3",
  "overview-skeleton-4",
  "overview-skeleton-5",
  "overview-skeleton-6",
] as const;
const WARNING_REASON_PREFIX = "Advertencia:";

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

type AutoLinkScope = "all_periods" | "selected_period";
type AutoLinkStrategy = "missing_only" | "relink_all";
type AutoLinkMode =
  | "selected_period_missing_only"
  | "selected_period_relink_all"
  | "all_periods_missing_only"
  | "all_periods_relink_all";
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

interface EventDayGroup {
  date: string;
  items: EventDteOverviewItem[];
  linkedCount: number;
  pendingCount: number;
  unlinkedCount: number;
}

function getAutoLinkModeConfig(mode: AutoLinkMode): {
  description: string;
  label: string;
  scope: AutoLinkScope;
  strategy: AutoLinkStrategy;
} {
  switch (mode) {
    case "selected_period_missing_only":
      return {
        description: "Sólo procesa eventos sin vínculo dentro del período seleccionado.",
        label: "Solo este período · sólo faltantes",
        scope: "selected_period",
        strategy: "missing_only",
      };
    case "selected_period_relink_all":
      return {
        description:
          "Re-evalúa todos los eventos del período y puede reemplazar vínculos existentes.",
        label: "Solo este período · re-vincular todo",
        scope: "selected_period",
        strategy: "relink_all",
      };
    case "all_periods_missing_only":
      return {
        description:
          "Procesa todos los períodos hasta hoy, pero sólo eventos todavía no vinculados.",
        label: "Todos los períodos hasta hoy · sólo faltantes",
        scope: "all_periods",
        strategy: "missing_only",
      };
    case "all_periods_relink_all":
      return {
        description:
          "Re-evalúa todos los períodos hasta hoy y puede sobrescribir vínculos existentes.",
        label: "Todos los períodos hasta hoy · re-vincular todo",
        scope: "all_periods",
        strategy: "relink_all",
      };
  }
}

function autoLinkStrategyLabel(strategy: AutoLinkStrategy): string {
  return strategy === "missing_only" ? "Sólo faltantes" : "Re-vincular todo";
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
  return dayjs(attemptedAt).tz().format("DD-MM-YYYY HH:mm");
}

function seriesKindLabel(kind: EventDteOverviewItem["seriesKind"]): string | null {
  if (kind === "PATCH_TEST") return "Test de parche";
  if (kind === "SKIN_TEST") return "Test cutáneo";
  if (kind === "SUBCUTANEOUS_TREATMENT") return "Tratamiento subcutáneo";
  return null;
}

const AUTO_LINK_MAX_AMOUNT_DIFF = 5000;

function describeAutoLinkSkipReason(params: {
  currentAmountDiff?: null | number;
  currentHypothesis?: EventDteMatchHypothesis | null;
  reason: string;
}): {
  detail: string;
  severity: "danger" | "warning";
  title: string;
  tooltipLabel: string;
} {
  const { currentAmountDiff = null, currentHypothesis = null, reason } = params;
  const scoreMatch = /^Score bajo \((\d+)\)$/.exec(reason);
  if (scoreMatch) {
    const score = Number(scoreMatch[1] ?? 0);
    if (currentHypothesis && currentHypothesis.score >= 90) {
      return {
        detail: `En el último intento automático la mejor coincidencia quedó en ${score}%. Las sugerencias actuales ya muestran ${Math.round(currentHypothesis.score)}%, así que ese motivo quedó desactualizado.`,
        severity: "warning",
        title: "Intento previo con score insuficiente",
        tooltipLabel: "Intento previo",
      };
    }
    return {
      detail: `En el último intento automático la mejor coincidencia alcanzó ${score}% y el mínimo para auto-vincular es 90%. Requiere revisión manual.`,
      severity: "warning",
      title: `Coincidencia insuficiente (${score}%)`,
      tooltipLabel: "Score insuficiente",
    };
  }

  const amountDiffMatch = /^Monto no coincide \(dif (\d+)\)$/.exec(reason);
  if (amountDiffMatch) {
    const amountDiff = Number(amountDiffMatch[1] ?? 0);
    if (currentAmountDiff != null && currentAmountDiff <= AUTO_LINK_MAX_AMOUNT_DIFF) {
      return {
        detail: `En el último intento automático se registró una diferencia de ${currencyFormatter.format(amountDiff)}. Las sugerencias actuales muestran ${currencyFormatter.format(currentAmountDiff)}, así que ese motivo ya no representa el estado actual.`,
        severity: "warning",
        title: "Intento previo con monto fuera de rango",
        tooltipLabel: "Intento previo",
      };
    }
    return {
      detail: `En el último intento automático la mejor sugerencia difería en ${currencyFormatter.format(amountDiff)}. El auto-vínculo sólo se permite hasta ${currencyFormatter.format(AUTO_LINK_MAX_AMOUNT_DIFF)} de diferencia.`,
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
    if (currentHypothesis) {
      return {
        detail:
          "En el último intento automático no apareció una coincidencia suficiente. Las sugerencias actuales ya encontraron candidatos plausibles, así que revisa el estado actual de esta tarjeta.",
        severity: "warning",
        title: "Intento previo sin coincidencias",
        tooltipLabel: "Intento previo",
      };
    }
    return {
      detail:
        "En el último intento automático no apareció ninguna boleta o factura con coincidencia suficiente en nombre, RUT o contexto del evento.",
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

function warningReasons(reasons: string[]): string[] {
  return reasons.filter((reason) => reason.startsWith(WARNING_REASON_PREFIX));
}

function nonWarningReasons(reasons: string[]): string[] {
  return reasons.filter((reason) => !reason.startsWith(WARNING_REASON_PREFIX));
}

function warningLabel(reasons: string[]): null | string {
  const warnings = warningReasons(reasons);
  if (warnings.length === 0) return null;
  return warnings.length === 1 ? "Advertencia de serie" : `${warnings.length} advertencias`;
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

function formatEventDayLabel(date: string): string {
  return dayjs(date).locale("es").format("dddd D [de] MMMM");
}

function groupOverviewItemsByDate(items: EventDteOverviewItem[]): EventDayGroup[] {
  const grouped = new Map<string, EventDayGroup>();

  items.forEach((item) => {
    const current =
      grouped.get(item.eventDate) ??
      ({
        date: item.eventDate,
        items: [],
        linkedCount: 0,
        pendingCount: 0,
        unlinkedCount: 0,
      } satisfies EventDayGroup);

    current.items.push(item);

    if (item.linkStatus === "linked") {
      current.linkedCount += 1;
    } else if (item.linkStatus === "pending_issuance") {
      current.pendingCount += 1;
    } else {
      current.unlinkedCount += 1;
    }

    grouped.set(item.eventDate, current);
  });

  return Array.from(grouped.values());
}

interface SuggestionExplorerProps {
  confirmPending: boolean;
  item: EventDteOverviewItem;
  onConfirmHypothesis: (candidate: EventDteMatchHypothesis) => void;
  onConfirmSingle: (candidate: EventDteSuggestion) => void;
}

function SuggestionCandidateCard({
  candidate,
  confirmPending,
  eventAmount,
  index,
  label,
  onConfirm,
}: Readonly<{
  candidate: EventDteSuggestion;
  confirmPending: boolean;
  eventAmount: null | number;
  index: number;
  label: null | string;
  onConfirm: (candidate: EventDteSuggestion) => void;
}>) {
  const diff = eventAmount != null ? Math.abs(eventAmount - candidate.totalAmount) : null;
  const candidateWarnings = warningReasons(candidate.reasons);
  const candidateNotes = nonWarningReasons(candidate.reasons);

  return (
    <Card className="gap-3" variant={index === 0 ? "secondary" : "default"}>
      <Card.Header className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 space-y-1">
          <Card.Title className="truncate text-sm">{candidate.clientName}</Card.Title>
          <Card.Description>
            {candidate.clientRUT} · Folio {candidate.folio} ·{" "}
            {dayjs(candidate.documentDate).format("DD-MM-YYYY")}
          </Card.Description>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Chip color={scoreColor(candidate.confidenceScore)} size="sm" variant="soft">
            Score {scoreLabel(candidate.confidenceScore)}
          </Chip>
          <Chip color="default" size="sm" variant="soft">
            {suggestionMethodLabel(candidate.method)}
          </Chip>
          {candidateWarnings.length > 0 ? (
            <Chip color="warning" size="sm" variant="soft">
              {warningLabel(candidate.reasons)}
            </Chip>
          ) : null}
          {label ? (
            <Chip color="default" size="sm" variant="tertiary">
              {label}
            </Chip>
          ) : null}
        </div>
      </Card.Header>
      <Card.Content className="grid grid-cols-2 gap-2 text-sm lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
        <Surface className="rounded-xl p-2.5" variant="secondary">
          <p className="text-default-500 text-[11px] uppercase tracking-wide">Monto DTE</p>
          <p className="font-medium leading-tight">
            {currencyFormatter.format(candidate.totalAmount)}
          </p>
        </Surface>
        <Surface className="rounded-xl p-2.5" variant="secondary">
          <p className="text-default-500 text-[11px] uppercase tracking-wide">Diferencia</p>
          <p className="font-medium leading-tight">
            {diff != null ? currencyFormatter.format(diff) : "-"}
          </p>
        </Surface>
        <Button
          className="self-end lg:self-auto"
          isPending={confirmPending}
          size="sm"
          variant={index === 0 ? "primary" : "tertiary"}
          onPress={() => onConfirm(candidate)}
        >
          Vincular este DTE
        </Button>
      </Card.Content>
      {candidateWarnings.length > 0 ? (
        <Card.Content className="pt-0">
          <Alert status="warning">
            <Alert.Content>
              <Alert.Description>{candidateWarnings[0]}</Alert.Description>
            </Alert.Content>
          </Alert>
        </Card.Content>
      ) : null}
      <Card.Footer className="flex flex-wrap gap-2 pt-0">
        {candidateNotes.slice(0, 3).map((reason) => (
          <Chip key={`${candidate.dteSaleDetailId}-${reason}`} size="sm" variant="soft">
            {reason}
          </Chip>
        ))}
      </Card.Footer>
    </Card>
  );
}

function HypothesisCard({
  hypothesis,
  confirmPending,
  eventAmount,
  index,
  label,
  onConfirm,
}: Readonly<{
  hypothesis: EventDteMatchHypothesis;
  confirmPending: boolean;
  eventAmount: null | number;
  index: number;
  label: null | string;
  onConfirm: (hypothesis: EventDteMatchHypothesis) => void;
}>) {
  const diff = eventAmount != null ? Math.abs(eventAmount - hypothesis.totalAmount) : null;
  const isBundle = hypothesis.kind === "bundle";
  const hypothesisWarnings = warningReasons(hypothesis.reasons);
  const hypothesisNotes = nonWarningReasons(hypothesis.reasons);

  return (
    <Card className="gap-3" variant={index === 0 ? "secondary" : "default"}>
      <Card.Header className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 space-y-1">
          <Card.Title className="truncate text-sm">{hypothesis.clientName}</Card.Title>
          <Card.Description>
            {hypothesis.clientRUT} ·{" "}
            {hypothesis.folios.map((folio) => `Folio ${folio}`).join(" + ")} ·{" "}
            {dayjs(hypothesis.documentDate).format("DD-MM-YYYY")}
          </Card.Description>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Chip color={isBundle ? "accent" : "default"} size="sm" variant="soft">
            {isBundle
              ? `Sugerencia compuesta · ${hypothesis.dteSaleDetailIds.length} DTE`
              : "Hipótesis principal"}
          </Chip>
          <Chip color={scoreColor(hypothesis.score)} size="sm" variant="soft">
            Score {scoreLabel(hypothesis.score)}
          </Chip>
          <Chip color="default" size="sm" variant="soft">
            {suggestionMethodLabel(hypothesis.method)}
          </Chip>
          {hypothesisWarnings.length > 0 ? (
            <Chip color="warning" size="sm" variant="soft">
              {warningLabel(hypothesis.reasons)}
            </Chip>
          ) : null}
          {label ? (
            <Chip color="default" size="sm" variant="tertiary">
              {label}
            </Chip>
          ) : null}
        </div>
      </Card.Header>
      <Card.Content className="grid grid-cols-2 gap-2 text-sm lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
        <Surface className="rounded-xl p-2.5" variant="secondary">
          <p className="text-default-500 text-[11px] uppercase tracking-wide">
            {isBundle ? "Suma DTE" : "Monto DTE"}
          </p>
          <p className="font-medium leading-tight">
            {currencyFormatter.format(hypothesis.totalAmount)}
          </p>
        </Surface>
        <Surface className="rounded-xl p-2.5" variant="secondary">
          <p className="text-default-500 text-[11px] uppercase tracking-wide">Diferencia</p>
          <p className="font-medium leading-tight">
            {diff != null ? currencyFormatter.format(diff) : "-"}
          </p>
        </Surface>
        <Button
          className="self-end lg:self-auto"
          isPending={confirmPending}
          size="sm"
          variant={index === 0 ? "primary" : "tertiary"}
          onPress={() => onConfirm(hypothesis)}
        >
          Vincular hipótesis
        </Button>
      </Card.Content>
      <Card.Content className="gap-2 pt-0">
        {hypothesis.documents.map((document) => (
          <Surface
            className="flex items-center justify-between gap-3 rounded-xl p-2.5"
            key={document.dteSaleDetailId}
            variant="secondary"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">Folio {document.folio}</p>
              <Description className="text-xs">{document.clientRUT}</Description>
            </div>
            <Chip color="default" size="sm" variant="soft">
              {currencyFormatter.format(document.totalAmount)}
            </Chip>
          </Surface>
        ))}
      </Card.Content>
      {hypothesisWarnings.length > 0 ? (
        <Card.Content className="pt-0">
          <Alert status="warning">
            <Alert.Content>
              <Alert.Description>{hypothesisWarnings[0]}</Alert.Description>
            </Alert.Content>
          </Alert>
        </Card.Content>
      ) : null}
      <Card.Footer className="flex flex-wrap gap-2 pt-0">
        {hypothesisNotes.slice(0, 3).map((reason) => (
          <Chip key={`${hypothesis.dteSaleDetailIds.join("-")}-${reason}`} size="sm" variant="soft">
            {reason}
          </Chip>
        ))}
      </Card.Footer>
    </Card>
  );
}

function SuggestionExplorer({
  confirmPending,
  item,
  onConfirmHypothesis,
  onConfirmSingle,
}: Readonly<SuggestionExplorerProps>) {
  const [isExpanded, setIsExpanded] = useState(
    item.lastAutoLinkSkip?.reason === "Ambiguo" || item.topHypothesis == null
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

  const hypotheses = suggestionsQuery.data?.hypotheses ?? [];
  const fallbackCandidates = suggestionsQuery.data?.fallbackCandidates ?? [];
  const topHypotheses = hypotheses.slice(0, 3);
  const topFallbackCandidates = fallbackCandidates.slice(0, 3);
  const label = seriesKindLabel(item.seriesKind);
  const disclosureCount = hypotheses.length > 0 ? hypotheses.length : fallbackCandidates.length;
  const eventAmount = amountHint(item);

  return (
    <Disclosure isExpanded={isExpanded} onExpandedChange={setIsExpanded}>
      <Disclosure.Heading>
        <Button className="w-full justify-between rounded-2xl" slot="trigger" variant="secondary">
          <span className="flex items-center gap-2">
            <span>Candidatos revisados</span>
            {disclosureCount > 0 ? (
              <Chip color="default" size="sm" variant="soft">
                {disclosureCount}
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
              <Alert.Content>
                <Alert.Description>
                  Evento futuro: los candidatos se revisan cuando llegue la fecha de emisión.
                </Alert.Description>
              </Alert.Content>
            </Alert>
          ) : null}

          {suggestionsQuery.isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-24 rounded-2xl" />
              <Skeleton className="h-24 rounded-2xl" />
            </div>
          ) : null}

          {suggestionsQuery.isError ? (
            <Alert status="danger">
              <Alert.Content>
                <Alert.Description>
                  No se pudieron cargar los candidatos del evento.
                </Alert.Description>
              </Alert.Content>
            </Alert>
          ) : null}

          {!suggestionsQuery.isLoading &&
          !suggestionsQuery.isError &&
          item.linkStatus !== "pending_issuance" ? (
            <div className="space-y-3">
              {topHypotheses.length > 0 ? (
                <>
                  {topHypotheses[0]?.kind === "bundle" ? (
                    <Alert status="warning">
                      <Alert.Content>
                        <Alert.Description>
                          Test cutáneo con hipótesis compuesta. Todas las DTE del grupo comparten el
                          mismo RUT y la suma calza con el monto del evento.
                        </Alert.Description>
                      </Alert.Content>
                    </Alert>
                  ) : null}
                  {topHypotheses.map((hypothesis, index) => (
                    <HypothesisCard
                      hypothesis={hypothesis}
                      confirmPending={confirmPending}
                      eventAmount={eventAmount}
                      index={index}
                      key={hypothesis.hypothesisId}
                      label={label}
                      onConfirm={onConfirmHypothesis}
                    />
                  ))}
                </>
              ) : topFallbackCandidates.length > 0 ? (
                <>
                  <Alert status="warning">
                    <Alert.Content>
                      <Alert.Description>
                        No hubo coincidencias suficientes. Estas DTE del mismo día siguen sin
                        eventos vinculados y pueden revisarse manualmente.
                      </Alert.Description>
                    </Alert.Content>
                  </Alert>
                  {topFallbackCandidates.map((candidate, index) => (
                    <SuggestionCandidateCard
                      candidate={candidate}
                      confirmPending={confirmPending}
                      eventAmount={eventAmount}
                      index={index}
                      key={candidate.dteSaleDetailId}
                      label={label}
                      onConfirm={onConfirmSingle}
                    />
                  ))}
                </>
              ) : (
                <Alert status="danger">
                  <Alert.Content>
                    <Alert.Description>
                      No hay candidatos disponibles para este evento.
                    </Alert.Description>
                  </Alert.Content>
                </Alert>
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
      candidate: EventDteMatchHypothesis | EventDteSuggestion;
      item: EventDteOverviewItem;
    }) => {
      await confirmEventDteLink({
        calendarId: item.calendarId,
        confidenceScore: "score" in candidate ? candidate.score : candidate.confidenceScore,
        dteSaleDetailIds:
          "dteSaleDetailIds" in candidate
            ? candidate.dteSaleDetailIds
            : [candidate.dteSaleDetailId],
        eventId: item.eventId,
        matchedBy: candidate.method,
        matchedName: candidate.clientName,
        matchedRUT: candidate.clientRUT,
        hypothesis: "hypothesisId" in candidate ? candidate : undefined,
        hypothesisKind: "kind" in candidate ? candidate.kind : "single",
        policyKey: "policyKey" in candidate ? candidate.policyKey : "same_day_unlinked_fallback",
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
    mutationFn: async (strategy: AutoLinkStrategy) =>
      autoLinkEventDteByPeriod({ period: search.period, strategy }),
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "No se pudo auto-vincular");
    },
    onSuccess: async (result, strategy) => {
      setAutoLinkSummary({
        linked: result.linked,
        modeLabel: `Período ${result.period} · ${autoLinkStrategyLabel(strategy)}`,
        processedLabel: `${result.daysProcessed} días`,
        skipped: result.skipped,
        skippedByReason: result.skippedByReason,
      });
      toast.success(
        `Auto-vinculación ${result.period} · ${autoLinkStrategyLabel(strategy)}: ${result.linked} vinculados, ${result.skipped} omitidos (${result.daysProcessed} días)`
      );
      await refetchOverview();
    },
  });

  const startAutoLinkAllPeriodsMutation = useMutation({
    mutationFn: (strategy: AutoLinkStrategy) =>
      startAutoLinkEventDteAllPeriodsJob({ periodConcurrency: 3, strategy }),
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "No se pudo iniciar auto-vinculación");
    },
    onSuccess: (result, strategy) => {
      setActiveAutoLinkJobId(result.jobId);
      toast.info(
        `Auto-vinculación iniciada · ${autoLinkStrategyLabel(strategy)}: ${result.totalPeriods} períodos en lotes (concurrencia ${result.periodConcurrency}).`
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
        strategy?: AutoLinkStrategy;
      };
      const strategy = result.strategy ?? "missing_only";
      setAutoLinkSummary({
        linked: result.linked,
        modeLabel: `Todos los períodos hasta hoy · ${autoLinkStrategyLabel(strategy)}`,
        processedLabel: `${result.periodsProcessed} períodos`,
        skipped: result.skipped,
        skippedByReason: result.skippedByReason ?? [],
      });
      toast.success(
        `Auto-vinculación completa · ${autoLinkStrategyLabel(strategy)}: ${result.linked} vinculados, ${result.skipped} omitidos (${result.periodsProcessed} períodos)`
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
  const groupedItems = groupOverviewItemsByDate(items);

  return (
    <div className="space-y-4">
      <Surface
        className="rounded-[28px] border border-default-200/70 p-4 sm:p-5"
        variant="secondary"
      >
        <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_220px_minmax(320px,1fr)_auto] xl:items-end">
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
          <div className="space-y-1">
            <Label>Buscar</Label>
            <div className="flex gap-2">
              <SearchField
                className="min-w-0 flex-1"
                onChange={setQueryDraft}
                value={queryDraft}
                variant="secondary"
              >
                <Label className="sr-only">Buscar por título o descripción</Label>
                <SearchField.Group>
                  <SearchField.SearchIcon />
                  <SearchField.Input
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        onSearchChange({ page: 0, query: queryDraft.trim() || undefined });
                      }
                    }}
                    placeholder="Buscar por título o descripción"
                  />
                  <SearchField.ClearButton />
                </SearchField.Group>
              </SearchField>
              <Button
                className="shrink-0"
                variant="secondary"
                onPress={() => onSearchChange({ page: 0, query: queryDraft.trim() || undefined })}
              >
                Filtrar
              </Button>
            </div>
          </div>
          <Dropdown>
            <Dropdown.Trigger>
              <Button
                className="w-full xl:w-auto"
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
                  const modeConfig = getAutoLinkModeConfig(String(key) as AutoLinkMode);
                  if (modeConfig.scope === "all_periods") {
                    startAutoLinkAllPeriodsMutation.mutate(modeConfig.strategy);
                    return;
                  }
                  autoLinkPeriodMutation.mutate(modeConfig.strategy);
                }}
              >
                <Dropdown.Item
                  id="selected_period_missing_only"
                  isDisabled={autoLinkActionPending || isAutoLinkRunning}
                  textValue={`Solo este período ${search.period} sólo faltantes`}
                >
                  <div className="space-y-0.5">
                    <Label>Solo este período · sólo faltantes</Label>
                    <Description>{search.period} · Sólo eventos sin vínculo actual.</Description>
                  </div>
                </Dropdown.Item>
                <Dropdown.Item
                  id="selected_period_relink_all"
                  isDisabled={autoLinkActionPending || isAutoLinkRunning}
                  textValue={`Solo este período ${search.period} re-vincular todo`}
                >
                  <div className="space-y-0.5">
                    <Label>Solo este período · re-vincular todo</Label>
                    <Description>
                      {search.period} · Recalcula y puede reemplazar vínculos.
                    </Description>
                  </div>
                </Dropdown.Item>
                <Dropdown.Item
                  id="all_periods_missing_only"
                  isDisabled={autoLinkActionPending || isAutoLinkRunning}
                  textValue="Todos los períodos hasta hoy sólo faltantes"
                >
                  <div className="space-y-0.5">
                    <Label>Todos los períodos hasta hoy · sólo faltantes</Label>
                    <Description>Procesa backlog sin tocar vínculos ya confirmados.</Description>
                  </div>
                </Dropdown.Item>
                <Dropdown.Item
                  id="all_periods_relink_all"
                  isDisabled={autoLinkActionPending || isAutoLinkRunning}
                  textValue="Todos los períodos hasta hoy re-vincular todo"
                >
                  <div className="space-y-0.5">
                    <Label>Todos los períodos hasta hoy · re-vincular todo</Label>
                    <Description>
                      Re-evalúa todo el histórico exigible y puede sobrescribir.
                    </Description>
                  </div>
                </Dropdown.Item>
              </Dropdown.Menu>
            </Dropdown.Popover>
          </Dropdown>
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
            variant="secondary"
            selectedKey={search.status}
            onSelectionChange={(key) =>
              onSearchChange({ page: 0, status: String(key) as LinkStatusFilter })
            }
          >
            <Tabs.ListContainer>
              <Tabs.List aria-label="Filtro de estado" className="w-fit">
                <Tabs.Tab id="all">
                  <span className="flex items-center gap-1.5 whitespace-nowrap">
                    Todos
                    {stats != null && (
                      <Chip size="sm" variant="soft">
                        {(stats.totalEvents ?? 0) - (stats.pendingIssuanceEvents ?? 0)}
                      </Chip>
                    )}
                  </span>
                  <Tabs.Indicator />
                </Tabs.Tab>
                <Tabs.Tab id="linked">
                  <span className="flex items-center gap-1.5 whitespace-nowrap">
                    Vinculados
                    {stats != null && (
                      <Chip size="sm" variant="soft" className="text-success">
                        {stats.linkedEvents ?? 0}
                      </Chip>
                    )}
                  </span>
                  <Tabs.Separator />
                  <Tabs.Indicator />
                </Tabs.Tab>
                <Tabs.Tab id="unlinked">
                  <span className="flex items-center gap-1.5 whitespace-nowrap">
                    No vinculados
                    {stats != null && (
                      <Chip size="sm" variant="soft" className="text-warning">
                        {stats.unlinkedEvents ?? 0}
                      </Chip>
                    )}
                  </span>
                  <Tabs.Separator />
                  <Tabs.Indicator />
                </Tabs.Tab>
                <Tabs.Tab id="pending_issuance">
                  <span className="flex items-center gap-1.5 whitespace-nowrap">
                    Pendiente emisión
                    {stats != null && (
                      <Chip size="sm" variant="soft">
                        {stats.pendingIssuanceEvents ?? 0}
                      </Chip>
                    )}
                  </span>
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
                {groupedItems.length === 0 ? (
                  <Card variant="transparent">
                    <Card.Header>
                      <Card.Title className="text-base">Sin resultados</Card.Title>
                      <Card.Description>Ajusta los filtros o prueba otro período.</Card.Description>
                    </Card.Header>
                  </Card>
                ) : null}

                {groupedItems.length > 0 ? (
                  <Accordion
                    allowsMultipleExpanded
                    className="space-y-3"
                    hideSeparator
                    variant="surface"
                  >
                    {groupedItems.map((group, groupIndex) => (
                      <Accordion.Item
                        className="overflow-hidden rounded-2xl border border-default-200/70 bg-default-50/40"
                        defaultExpanded={groupIndex === 0}
                        id={group.date}
                        key={group.date}
                      >
                        <Accordion.Heading>
                          <Accordion.Trigger className="flex w-full flex-wrap items-center gap-3 px-4 py-3 text-left hover:bg-default-100/60 data-[hover=true]:bg-default-100/60">
                            <div className="min-w-0 flex-1">
                              <p className="font-semibold text-sm">
                                {formatEventDayLabel(group.date)}
                              </p>
                              <Description className="text-xs">
                                {dayjs(group.date).format("DD-MM-YYYY")} · {group.items.length}{" "}
                                eventos
                              </Description>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                              {group.unlinkedCount > 0 ? (
                                <Chip color="warning" size="sm" variant="soft">
                                  {group.unlinkedCount} no vinculados
                                </Chip>
                              ) : null}
                              {group.linkedCount > 0 ? (
                                <Chip color="success" size="sm" variant="soft">
                                  {group.linkedCount} vinculados
                                </Chip>
                              ) : null}
                              {group.pendingCount > 0 ? (
                                <Chip color="default" size="sm" variant="soft">
                                  {group.pendingCount} pendientes
                                </Chip>
                              ) : null}
                              <Accordion.Indicator className="text-default-400" />
                            </div>
                          </Accordion.Trigger>
                        </Accordion.Heading>
                        <Accordion.Panel className="pb-0">
                          <Accordion.Body className="border-default-200/70 border-t px-3 py-3 sm:px-4">
                            <div className="space-y-3">
                              {group.items.map((item) => {
                                const primarySuggestion = item.topHypothesis;
                                const displayAmount = item.linked
                                  ? item.linkedTotalAmount
                                  : (primarySuggestion?.totalAmount ?? null);
                                const currentHint = amountHint(item);
                                const localDiff =
                                  currentHint != null && displayAmount != null
                                    ? Math.abs(currentHint - displayAmount)
                                    : (primarySuggestion?.amountDiff ?? null);
                                const autoLinkSkipReason = item.lastAutoLinkSkip
                                  ? describeAutoLinkSkipReason({
                                      currentAmountDiff: localDiff,
                                      currentHypothesis: primarySuggestion,
                                      reason: item.lastAutoLinkSkip.reason,
                                    })
                                  : null;
                                const primaryWarningLabel = primarySuggestion
                                  ? warningLabel(primarySuggestion.reasons)
                                  : null;

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
                                          {dayjs(item.eventDate).format("DD-MM-YYYY")}
                                          {item.eventTime ? ` · ${item.eventTime}` : ""}
                                        </Card.Description>
                                      </div>
                                      <div className="flex flex-wrap items-center gap-2 lg:max-w-[45%] lg:justify-end">
                                        <Chip
                                          color={linkStatusColor(item.linkStatus)}
                                          variant="soft"
                                        >
                                          {linkStatusLabel(item.linkStatus)}
                                        </Chip>
                                        {item.displayName ? (
                                          <Chip color="default" size="sm" variant="soft">
                                            {item.displayName}
                                          </Chip>
                                        ) : null}
                                        {item.seriesKind && !item.displayName ? (
                                          <Chip color="default" size="sm" variant="tertiary">
                                            {seriesKindLabel(item.seriesKind)}
                                          </Chip>
                                        ) : null}
                                        {!item.linked && item.topHypothesis?.kind === "bundle" ? (
                                          <Chip color="accent" size="sm" variant="soft">
                                            Bundle · {item.topHypothesis.dteSaleDetailIds.length}{" "}
                                            DTE
                                          </Chip>
                                        ) : null}
                                        {item.linked && item.linkedDocuments.length > 1 ? (
                                          <Chip color="accent" size="sm" variant="soft">
                                            {item.linkedDocuments.length} DTE vinculadas
                                          </Chip>
                                        ) : null}
                                        {item.linkStatus !== "pending_issuance" ? (
                                          <Chip
                                            color={scoreColor(
                                              item.linked
                                                ? item.confidenceScore
                                                : (primarySuggestion?.score ?? null)
                                            )}
                                            variant="soft"
                                          >
                                            Score{" "}
                                            {scoreLabel(
                                              item.linked
                                                ? item.confidenceScore
                                                : (primarySuggestion?.score ?? null)
                                            )}
                                          </Chip>
                                        ) : null}
                                        {item.linked && (item.confidenceScore ?? 0) === 100 ? (
                                          <Chip color="success" variant="soft">
                                            Perfecto 100
                                          </Chip>
                                        ) : null}
                                        {!item.linked && primaryWarningLabel ? (
                                          <Chip color="warning" size="sm" variant="soft">
                                            {primaryWarningLabel}
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
                                            ? item.linkedDocuments.length > 1
                                              ? item.linkedDocuments
                                                  .map((document) => `Folio ${document.folio}`)
                                                  .join(" + ")
                                              : `Folio ${item.linkedFolio ?? "-"}`
                                            : item.topHypothesis
                                              ? item.topHypothesis.folios
                                                  .map((folio) => `Folio ${folio}`)
                                                  .join(" + ")
                                              : "Sin sugerencia"}
                                        </p>
                                      </Surface>
                                    </Card.Content>

                                    {!item.linked && item.lastAutoLinkSkip ? (
                                      <Card.Content className="pt-0">
                                        <Alert status={autoLinkSkipReason?.severity ?? "warning"}>
                                          <Alert.Content>
                                            <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                                              <div className="space-y-1">
                                                <p className="text-[11px] font-semibold uppercase tracking-wide">
                                                  Último intento automático omitido
                                                </p>
                                                <Alert.Description className="text-sm font-medium">
                                                  {autoLinkSkipReason?.title ??
                                                    item.lastAutoLinkSkip.reason}
                                                </Alert.Description>
                                                <Alert.Description className="text-sm">
                                                  {autoLinkSkipReason?.detail ??
                                                    item.lastAutoLinkSkip.reason}
                                                </Alert.Description>
                                                <Alert.Description className="text-xs">
                                                  Intentado{" "}
                                                  {formatAutoLinkAttempt(
                                                    item.lastAutoLinkSkip.attemptedAt
                                                  )}
                                                </Alert.Description>
                                              </div>
                                              <Tooltip delay={0}>
                                                <Tooltip.Trigger aria-label="Detalle del último intento de auto-vinculación">
                                                  <Chip
                                                    color={
                                                      autoLinkSkipReason?.severity ?? "warning"
                                                    }
                                                    size="sm"
                                                    variant="soft"
                                                  >
                                                    {autoLinkSkipReason?.tooltipLabel ??
                                                      "Intento previo"}
                                                  </Chip>
                                                </Tooltip.Trigger>
                                                <Tooltip.Content className="max-w-sm" showArrow>
                                                  <Tooltip.Arrow />
                                                  <div className="space-y-1">
                                                    <p className="font-medium">
                                                      {autoLinkSkipReason?.title ??
                                                        item.lastAutoLinkSkip.reason}
                                                    </p>
                                                    <p>
                                                      {autoLinkSkipReason?.detail ??
                                                        item.lastAutoLinkSkip.reason}
                                                    </p>
                                                    <p>
                                                      Último intento:{" "}
                                                      {formatAutoLinkAttempt(
                                                        item.lastAutoLinkSkip.attemptedAt
                                                      )}
                                                    </p>
                                                  </div>
                                                </Tooltip.Content>
                                              </Tooltip>
                                            </div>
                                          </Alert.Content>
                                        </Alert>
                                      </Card.Content>
                                    ) : null}

                                    {!item.linked ? (
                                      <Card.Content className="pt-0">
                                        <SuggestionExplorer
                                          confirmPending={confirmMutation.isPending}
                                          item={item}
                                          onConfirmHypothesis={(candidate) =>
                                            confirmMutation.mutate({ item, candidate })
                                          }
                                          onConfirmSingle={(candidate) =>
                                            confirmMutation.mutate({ item, candidate })
                                          }
                                        />
                                      </Card.Content>
                                    ) : null}

                                    <Card.Footer className="flex flex-col gap-3 border-default-200/70 border-t pt-4 lg:flex-row lg:items-center lg:justify-between">
                                      <Description className="min-w-0">
                                        {item.linked
                                          ? `${item.linkedClientName ?? "-"} · ${item.linkedClientRUT ?? "-"} · ${
                                              item.linkedDocuments.length > 1
                                                ? item.linkedDocuments
                                                    .map((document) => `Folio ${document.folio}`)
                                                    .join(" + ")
                                                : `Folio ${item.linkedFolio ?? "-"}`
                                            }`
                                          : item.linkStatus === "pending_issuance"
                                            ? "Evento en fecha futura: se revisa vínculo cuando llegue el día de emisión."
                                            : item.topHypothesis
                                              ? `${item.topHypothesis.clientName} · ${item.topHypothesis.clientRUT} · ${item.topHypothesis.folios.map((folio) => `Folio ${folio}`).join(" + ")}`
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
                                              item.topHypothesis == null ||
                                              item.linkStatus === "pending_issuance"
                                            }
                                            isPending={confirmMutation.isPending}
                                            size="sm"
                                            variant="primary"
                                            onPress={() =>
                                              item.topHypothesis
                                                ? confirmMutation.mutate({
                                                    item,
                                                    candidate: item.topHypothesis,
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
                          </Accordion.Body>
                        </Accordion.Panel>
                      </Accordion.Item>
                    ))}
                  </Accordion>
                ) : null}
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
