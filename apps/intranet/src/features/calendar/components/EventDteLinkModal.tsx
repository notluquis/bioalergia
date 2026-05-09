import {
  Alert,
  Button,
  Chip,
  Description,
  Disclosure,
  Modal,
  Popover,
  ScrollShadow,
  Surface,
} from "@heroui/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";
import { useEffect, useMemo, useState } from "react";
import { useToast } from "@/context/ToastContext";
import { confirmEventDteLink, unlinkEventDteLink } from "@/features/calendar/api";
import { calendarDteLinkKeys, calendarDteLinkQueries } from "@/features/calendar/queries";
import type { CalendarEventDetail, EventDteMatchHypothesis } from "@/features/calendar/types";
import { currencyFormatter } from "@/lib/format";
import { FormattedEventDescription } from "./FormattedEventDescription";
const WARNING_REASON_PREFIX = "Advertencia:";

interface EventDteLinkModalProps {
  event: CalendarEventDetail | null;
  isOpen: boolean;
  onClose: () => void;
  onLinked: () => void;
}

interface EventDteLinkRow {
  clientName: string;
  clientRUT: string;
  confidenceScore: number;
  dteSaleDetailIds: string[];
  folioLabel: string;
  key: string;
  matchedBy: "manual" | "mixed" | "name_exact" | "name_fuzzy" | "rut";
  matchedName: string;
  matchedRUT: string;
  reasons: string[];
  totalAmount: number;
  hypothesis?: EventDteMatchHypothesis;
  hypothesisKind?: "bundle" | "single";
  policyKey?:
    | "default_same_day"
    | "same_day_unlinked_fallback"
    | "skin_test_bundle"
    | "reembolso_bundle";
}

interface LinkedEventDocumentRow {
  confidenceScore: number;
  createdAt: string;
  dte: {
    clientName: string;
    clientRUT: string;
    documentDate: string;
    documentType: number;
    folio: string;
    totalAmount: number;
  };
  dteSaleDetailId: string;
  matchedBy: string;
  matchedName: null | string;
  matchedRUT: null | string;
  status: "CONFIRMED" | "MANUAL" | "REJECTED";
  updatedAt: string;
}

function warningReasons(reasons: string[]): string[] {
  return reasons.filter((reason) => reason.startsWith(WARNING_REASON_PREFIX));
}

function infoReasons(reasons: string[]): string[] {
  return reasons.filter((reason) => !reason.startsWith(WARNING_REASON_PREFIX));
}

function formatSeriesEventHeadline(event: {
  seriesStageLabel?: null | string;
  summary?: null | string;
}) {
  return event.seriesStageLabel ?? event.summary ?? "Evento";
}

function formatSeriesEventSupport(event: {
  seriesStageLabel?: null | string;
  summary?: null | string;
}) {
  if (event.seriesStageLabel && event.summary) return event.summary;
  return null;
}

function compareSeriesEventsDesc(a: { eventDate: string }, b: { eventDate: string }) {
  return b.eventDate.localeCompare(a.eventDate);
}

export function EventDteLinkModal({ event, isOpen, onClose, onLinked }: EventDteLinkModalProps) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const today = dayjs().format("YYYY-MM-DD");
  const isPendingEmission = Boolean(event?.eventDate && event.eventDate > today);
  const [suggestionsExpanded, setSuggestionsExpanded] = useState(true);

  const suggestionsQuery = useQuery({
    ...calendarDteLinkQueries.suggestions({
      calendarId: event?.calendarId ?? "",
      eventId: event?.eventId ?? "",
      limit: 12,
      sameDayOnly: true,
    }),
    enabled: isOpen && Boolean(event?.calendarId && event?.eventId) && !isPendingEmission,
  });

  const confirmMutation = useMutation({
    mutationFn: (candidate: EventDteLinkRow) =>
      confirmEventDteLink({
        calendarId: event?.calendarId ?? "",
        confidenceScore: candidate.confidenceScore,
        dteSaleDetailIds: candidate.dteSaleDetailIds,
        eventId: event?.eventId ?? "",
        hypothesis: candidate.hypothesis,
        hypothesisKind: candidate.hypothesisKind,
        matchedBy: candidate.matchedBy,
        matchedName: candidate.matchedName,
        matchedRUT: candidate.matchedRUT,
        policyKey: candidate.policyKey,
      }),
    onSuccess: async () => {
      toast.success("Vínculo DTE confirmado");
      await queryClient.invalidateQueries({ queryKey: calendarDteLinkKeys.all });
      await queryClient.invalidateQueries({
        queryKey: calendarDteLinkKeys.suggestions(event?.calendarId, event?.eventId),
      });
      onLinked();
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "No se pudo confirmar el vínculo");
    },
  });

  const unlinkMutation = useMutation({
    mutationFn: () =>
      unlinkEventDteLink({
        calendarId: event?.calendarId ?? "",
        eventId: event?.eventId ?? "",
      }),
    onSuccess: async () => {
      toast.success("Vínculo eliminado");
      await queryClient.invalidateQueries({ queryKey: calendarDteLinkKeys.all });
      onLinked();
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "No se pudo eliminar vínculo");
    },
  });

  const candidates = useMemo(() => {
    const hypotheses = suggestionsQuery.data?.hypotheses ?? [];
    const hypothesisRows = hypotheses.map((hypothesis) => ({
      clientName: hypothesis.clientName,
      clientRUT: hypothesis.clientRUT,
      confidenceScore: hypothesis.score,
      crossSeriesConflicts: hypothesis.crossSeriesConflicts,
      dteSaleDetailIds: hypothesis.dteSaleDetailIds,
      folioLabel:
        hypothesis.kind === "bundle"
          ? `Folios ${hypothesis.folios.join(", ")}`
          : `Folio ${hypothesis.folios[0] ?? "-"}`,
      hypothesis,
      hypothesisKind: hypothesis.kind,
      key: hypothesis.hypothesisId,
      matchedBy: hypothesis.method,
      matchedName: hypothesis.clientName,
      matchedRUT: hypothesis.clientRUT,
      policyKey: hypothesis.policyKey,
      reasons: hypothesis.reasons,
      totalAmount: hypothesis.totalAmount,
    }));
    const usedIds = new Set(hypothesisRows.flatMap((row) => row.dteSaleDetailIds));
    const fallbackRows = (suggestionsQuery.data?.fallbackCandidates ?? [])
      .filter((candidate) => !usedIds.has(candidate.dteSaleDetailId))
      .map((candidate) => ({
        clientName: candidate.clientName,
        clientRUT: candidate.clientRUT,
        confidenceScore: candidate.confidenceScore,
        crossSeriesConflicts: [] as EventDteMatchHypothesis["crossSeriesConflicts"],
        dteSaleDetailIds: [candidate.dteSaleDetailId],
        folioLabel: `Folio ${candidate.folio}`,
        key: candidate.dteSaleDetailId,
        matchedBy: "manual" as const,
        matchedName: candidate.clientName,
        matchedRUT: candidate.clientRUT,
        policyKey: "same_day_unlinked_fallback" as const,
        reasons: candidate.reasons,
        totalAmount: candidate.totalAmount,
      }));

    return [...hypothesisRows, ...fallbackRows];
  }, [suggestionsQuery.data]);
  const currentLinks = useMemo<LinkedEventDocumentRow[]>(
    () =>
      Array.isArray(suggestionsQuery.data?.linked)
        ? (suggestionsQuery.data.linked as LinkedEventDocumentRow[])
        : [],
    [suggestionsQuery.data?.linked]
  );
  const series = suggestionsQuery.data?.series ?? null;
  const sortedSeriesEvents = useMemo(
    () => [...(series?.events ?? [])].sort(compareSeriesEventsDesc),
    [series?.events]
  );
  const sortedSeriesDocuments = useMemo(
    () =>
      [...(series?.linkedDocuments ?? [])].sort((a, b) => {
        const dateDiff = b.documentDate.localeCompare(a.documentDate);
        if (dateDiff !== 0) return dateDiff;
        return b.folio.localeCompare(a.folio);
      }),
    [series?.linkedDocuments]
  );
  const hasCurrentLink = currentLinks.length > 0;

  useEffect(() => {
    if (!isOpen) return;
    setSuggestionsExpanded(!hasCurrentLink);
  }, [hasCurrentLink, isOpen]);

  const seriesKindLabel = useMemo(() => {
    if (!series) {
      return null;
    }
    if (series.kind === "PATCH_TEST") return "Test de parche";
    if (series.kind === "SKIN_TEST") return "Test cutáneo";
    return "Tratamiento subcutáneo";
  }, [series]);

  return (
    <Modal>
      <Modal.Backdrop isOpen={isOpen} onOpenChange={(open) => !open && onClose()} variant="blur">
        <Modal.Container placement="center" scroll="inside" size="lg">
          <Modal.Dialog className="w-full max-w-[min(96vw,980px)]">
            <Modal.CloseTrigger />
            <Modal.Header>
              <Modal.Heading>Vincular evento con boleta DTE</Modal.Heading>
            </Modal.Header>
            <Modal.Body className="space-y-3 pb-4">
              <Surface className="rounded-xl p-3" variant="secondary">
                <p className="font-semibold text-sm">{event?.summary ?? "(Sin título)"}</p>
                <p className="text-default-500 text-xs">
                  {[event?.eventDate, event?.patientRut, event?.patientName]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
                {event?.description && event.description !== event.summary ? (
                  <FormattedEventDescription className="mt-1" text={event.description} />
                ) : null}
              </Surface>

              {series ? (
                <Surface
                  className="space-y-3 rounded-xl border border-primary/20 p-3"
                  variant="secondary"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-sm">
                        {series.displayName ?? `Serie clínica #${series.id}`}
                      </p>
                      <p className="text-default-500 text-xs">
                        {seriesKindLabel}
                        {series.patientRut ? ` · ${series.patientRut}` : ""}
                        {series.patientName ? ` · ${series.patientName}` : ""}
                      </p>
                    </div>
                    <div className="text-right text-xs">
                      <p>
                        Vinculado:{" "}
                        <span className="font-semibold">
                          {currencyFormatter.format(series.totalLinkedAmount)}
                        </span>
                      </p>
                      <p>
                        Saldo esperado:{" "}
                        <span className="font-semibold">
                          {currencyFormatter.format(series.remainingExpected)}
                        </span>
                      </p>
                      <p>
                        Saldo pagado:{" "}
                        <span className="font-semibold">
                          {currencyFormatter.format(series.remainingPaid)}
                        </span>
                      </p>
                    </div>
                  </div>

                  <div className="grid gap-2 md:grid-cols-2">
                    <Surface className="rounded-xl p-3" variant="default">
                      <p className="mb-2 font-semibold text-xs uppercase tracking-wide text-default-600">
                        Eventos de la serie
                      </p>
                      <ScrollShadow className="max-h-72">
                        <div className="space-y-2 text-xs pr-2">
                          {sortedSeriesEvents.map((seriesEvent) => (
                            <div
                              className="flex items-center justify-between gap-2"
                              key={`${seriesEvent.calendarGoogleId}-${seriesEvent.externalEventId}`}
                            >
                              <div className="min-w-0">
                                <p className="truncate font-medium">
                                  {formatSeriesEventHeadline(seriesEvent)}
                                </p>
                                <p className="truncate text-default-500">{seriesEvent.eventDate}</p>
                                {formatSeriesEventSupport(seriesEvent) ? (
                                  <p className="truncate text-default-400">
                                    {formatSeriesEventSupport(seriesEvent)}
                                  </p>
                                ) : null}
                              </div>
                              <div className="text-right">
                                {seriesEvent.amountExpected != null ? (
                                  <p>{currencyFormatter.format(seriesEvent.amountExpected)}</p>
                                ) : null}
                                {seriesEvent.amountPaid != null ? (
                                  <p className="text-success">
                                    {currencyFormatter.format(seriesEvent.amountPaid)}
                                  </p>
                                ) : null}
                              </div>
                            </div>
                          ))}
                        </div>
                      </ScrollShadow>
                    </Surface>

                    <Surface className="rounded-xl p-3" variant="default">
                      <p className="mb-2 font-semibold text-xs uppercase tracking-wide text-default-600">
                        Documentos ya vinculados
                      </p>
                      <ScrollShadow className="max-h-72">
                        <div className="space-y-2 text-xs pr-2">
                          {sortedSeriesDocuments.length === 0 ? (
                            <p className="text-default-500">
                              Todavía no hay DTE asociados a esta serie.
                            </p>
                          ) : (
                            sortedSeriesDocuments.map((doc) => (
                              <div
                                className="flex items-center justify-between gap-2"
                                key={doc.dteSaleDetailId}
                              >
                                <div className="min-w-0">
                                  <p className="truncate font-medium">
                                    {doc.clientName} · Folio {doc.folio}
                                  </p>
                                  <p className="truncate text-default-500">
                                    {doc.documentDate} · {doc.matchedBy}
                                  </p>
                                </div>
                                <p className="font-medium">
                                  {currencyFormatter.format(doc.totalAmount)}
                                </p>
                              </div>
                            ))
                          )}
                        </div>
                      </ScrollShadow>
                    </Surface>
                  </div>

                  <Description className="text-default-600">
                    Las sugerencias consideran toda la ventana de la serie (
                    {series.eligibleDocumentDateFrom} a {series.eligibleDocumentDateTo}) y excluyen
                    DTE ya vinculados dentro del mismo cluster.
                  </Description>
                </Surface>
              ) : null}

              {suggestionsQuery.isError ? (
                <Alert status="danger">
                  <Alert.Content>
                    <Alert.Description>No se pudieron cargar sugerencias.</Alert.Description>
                  </Alert.Content>
                </Alert>
              ) : null}

              {hasCurrentLink ? (
                <Surface className="space-y-3 rounded-xl p-3" variant="secondary">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold text-sm">Vínculo confirmado</p>
                      <Description>Este evento ya tiene boleta asociada.</Description>
                    </div>
                    <Button
                      isPending={unlinkMutation.isPending}
                      size="sm"
                      variant="danger"
                      onPress={() => unlinkMutation.mutate()}
                    >
                      Desvincular
                    </Button>
                  </div>
                  <div className="space-y-2">
                    {currentLinks.map((link) => (
                      <Surface
                        className="rounded-xl p-3"
                        key={link.dteSaleDetailId}
                        variant="default"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate font-medium">
                              {link.dte.clientName} · Folio {link.dte.folio}
                            </p>
                            <p className="text-default-500 text-xs">
                              {link.dte.clientRUT} · {link.dte.documentDate} · {link.matchedBy}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-semibold">
                              {currencyFormatter.format(link.dte.totalAmount)}
                            </p>
                            <p className="text-default-500 text-xs">
                              Score {Math.round(link.confidenceScore)}
                            </p>
                          </div>
                        </div>
                      </Surface>
                    ))}
                  </div>
                </Surface>
              ) : null}

              {isPendingEmission && !suggestionsQuery.data?.linked ? (
                <Alert status="warning">
                  <Alert.Content>
                    <Alert.Description>
                      Evento en fecha futura. El vínculo DTE se habilita cuando llegue la fecha de
                      emisión.
                    </Alert.Description>
                  </Alert.Content>
                </Alert>
              ) : null}

              {!isPendingEmission ? (
                <Disclosure
                  isExpanded={suggestionsExpanded}
                  onExpandedChange={setSuggestionsExpanded}
                >
                  <Disclosure.Heading>
                    <Button
                      className="w-full justify-between rounded-xl border border-default-200 px-3 py-3 h-auto"
                      slot="trigger"
                      variant="secondary"
                    >
                      <div className="flex w-full items-center justify-between gap-3 text-left">
                        <div>
                          <p className="font-semibold text-sm">
                            {hasCurrentLink
                              ? "Volver a vincular o revisar boletas"
                              : "Boletas y sugerencias"}
                          </p>
                          <Description>
                            {hasCurrentLink
                              ? "La lista queda colapsada por defecto porque ya existe un vínculo confirmado."
                              : "Las mejores hipótesis quedan abiertas porque el evento aún no tiene vínculo."}
                          </Description>
                        </div>
                        <div className="flex items-center gap-2">
                          <Chip size="sm" variant="soft">
                            {candidates.length}
                          </Chip>
                          <Disclosure.Indicator />
                        </div>
                      </div>
                    </Button>
                  </Disclosure.Heading>
                  <Disclosure.Content>
                    <Disclosure.Body className="px-0 pt-3">
                      {suggestionsQuery.isLoading ? (
                        <div className="space-y-2">
                          <Surface className="h-24 rounded-xl" variant="secondary">
                            {null}
                          </Surface>
                          <Surface className="h-24 rounded-xl" variant="secondary">
                            {null}
                          </Surface>
                        </div>
                      ) : candidates.length === 0 ? (
                        <Alert status="warning">
                          <Alert.Content>
                            <Alert.Description>Sin candidatos para este día.</Alert.Description>
                          </Alert.Content>
                        </Alert>
                      ) : (
                        <div className="space-y-3">
                          {candidates.map((candidate, index) => {
                            const warnings = warningReasons(candidate.reasons);
                            const notes = infoReasons(candidate.reasons);
                            return (
                              <Surface
                                className="space-y-3 rounded-xl p-3"
                                key={candidate.key}
                                variant={index === 0 ? "secondary" : "default"}
                              >
                                <div className="flex flex-wrap items-start justify-between gap-3">
                                  <div className="min-w-0">
                                    <p className="truncate font-medium">{candidate.clientName}</p>
                                    <p className="text-default-500 text-xs">
                                      {candidate.clientRUT} · {candidate.folioLabel}
                                    </p>
                                  </div>
                                  <div className="flex flex-wrap items-center gap-2">
                                    <Chip color="default" size="sm" variant="soft">
                                      {candidate.matchedBy}
                                    </Chip>
                                    <Chip color="default" size="sm" variant="soft">
                                      Score {Math.round(candidate.confidenceScore)}
                                    </Chip>
                                    {warnings.length > 0 ? (
                                      <Chip color="warning" size="sm" variant="soft">
                                        Advertencia
                                      </Chip>
                                    ) : null}
                                  </div>
                                </div>
                                <div className="grid gap-2 sm:grid-cols-3">
                                  <Surface className="rounded-lg p-2.5" variant="secondary">
                                    <p className="text-default-500 text-[11px] uppercase tracking-wide">
                                      Total
                                    </p>
                                    <p className="font-medium">
                                      {currencyFormatter.format(candidate.totalAmount)}
                                    </p>
                                  </Surface>
                                  <Surface className="rounded-lg p-2.5" variant="secondary">
                                    <p className="text-default-500 text-[11px] uppercase tracking-wide">
                                      Referencia
                                    </p>
                                    <p className="font-medium">{candidate.folioLabel}</p>
                                  </Surface>
                                  <Surface className="rounded-lg p-2.5" variant="secondary">
                                    <p className="text-default-500 text-[11px] uppercase tracking-wide">
                                      Tipo
                                    </p>
                                    <p className="font-medium">
                                      {"hypothesisKind" in candidate &&
                                      candidate.hypothesisKind === "bundle"
                                        ? "Hipótesis compuesta"
                                        : "DTE individual"}
                                    </p>
                                  </Surface>
                                </div>
                                {warnings.length > 0 ? (
                                  <div className="space-y-1.5">
                                    <Alert status="warning">
                                      <Alert.Content>
                                        <Alert.Description>{warnings[0]}</Alert.Description>
                                      </Alert.Content>
                                    </Alert>
                                    {candidate.crossSeriesConflicts.length > 0 ? (
                                      <Popover>
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          className="text-warning text-xs h-auto py-1"
                                        >
                                          Ver{" "}
                                          {candidate.crossSeriesConflicts.length === 1
                                            ? "serie en conflicto"
                                            : `${candidate.crossSeriesConflicts.length} series en conflicto`}{" "}
                                          →
                                        </Button>
                                        <Popover.Content placement="bottom start" className="w-72">
                                          <Popover.Dialog className="p-3 space-y-2">
                                            <p className="text-xs font-semibold text-foreground-500 uppercase tracking-wide mb-2">
                                              Series con este RUT vinculado
                                            </p>
                                            {candidate.crossSeriesConflicts.map((conflict) => (
                                              <Surface
                                                key={conflict.seriesId}
                                                className="rounded-lg p-2.5 space-y-0.5"
                                                variant="secondary"
                                              >
                                                <p className="text-sm font-medium leading-tight">
                                                  {conflict.patientName ??
                                                    conflict.patientRut ??
                                                    `Serie #${conflict.seriesId}`}
                                                </p>
                                                <p className="text-xs text-foreground-400">
                                                  {conflict.patientRut
                                                    ? `${conflict.patientRut} · `
                                                    : ""}
                                                  Serie #{conflict.seriesId}
                                                </p>
                                                <Chip
                                                  size="sm"
                                                  variant="tertiary"
                                                  color={
                                                    conflict.status === "ACTIVE"
                                                      ? "success"
                                                      : conflict.status === "CANCELLED"
                                                        ? "danger"
                                                        : "default"
                                                  }
                                                >
                                                  {conflict.status === "ACTIVE"
                                                    ? "Activa"
                                                    : conflict.status === "CANCELLED"
                                                      ? "Cancelada"
                                                      : "Completada"}
                                                </Chip>
                                              </Surface>
                                            ))}
                                          </Popover.Dialog>
                                        </Popover.Content>
                                      </Popover>
                                    ) : null}
                                  </div>
                                ) : null}
                                {notes.length > 0 ? (
                                  <div className="flex flex-wrap gap-2">
                                    {notes.slice(0, 3).map((reason) => (
                                      <Chip
                                        key={`${candidate.key}-${reason}`}
                                        size="sm"
                                        variant="soft"
                                      >
                                        {reason}
                                      </Chip>
                                    ))}
                                  </div>
                                ) : null}
                                <div className="flex justify-end">
                                  <Button
                                    isPending={confirmMutation.isPending}
                                    size="sm"
                                    variant="primary"
                                    onPress={() => confirmMutation.mutate(candidate)}
                                  >
                                    Vincular
                                  </Button>
                                </div>
                              </Surface>
                            );
                          })}
                        </div>
                      )}
                    </Disclosure.Body>
                  </Disclosure.Content>
                </Disclosure>
              ) : null}
            </Modal.Body>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
