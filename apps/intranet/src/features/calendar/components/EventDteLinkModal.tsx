import { Button, Chip, Description, Modal, Tooltip } from "@heroui/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import dayjs from "dayjs";
import { useMemo } from "react";
import { DataTable } from "@/components/data-table/DataTable";
import { useToast } from "@/context/ToastContext";
import { confirmEventDteLink, unlinkEventDteLink } from "@/features/calendar/api";
import { calendarDteLinkKeys, calendarDteLinkQueries } from "@/features/calendar/queries";
import type { CalendarEventDetail, EventDteMatchHypothesis } from "@/features/calendar/types";
import { currencyFormatter } from "@/lib/format";
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
  policyKey?: "default_same_day" | "same_day_unlinked_fallback" | "skin_test_bundle";
}

function warningReasons(reasons: string[]): string[] {
  return reasons.filter((reason) => reason.startsWith(WARNING_REASON_PREFIX));
}

export function EventDteLinkModal({ event, isOpen, onClose, onLinked }: EventDteLinkModalProps) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const today = dayjs().format("YYYY-MM-DD");
  const isPendingEmission = Boolean(event?.eventDate && event.eventDate > today);

  const suggestionsQuery = useQuery({
    ...calendarDteLinkQueries.suggestions({
      calendarId: event?.calendarId ?? "",
      eventId: event?.eventId ?? "",
      limit: 12,
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
  const series = suggestionsQuery.data?.series ?? null;

  const seriesKindLabel = useMemo(() => {
    if (!series) {
      return null;
    }
    if (series.kind === "PATCH_TEST") return "Test de parche";
    if (series.kind === "SKIN_TEST") return "Test cutáneo";
    return "Tratamiento subcutáneo";
  }, [series]);

  const suggestionColumns = useMemo<ColumnDef<EventDteLinkRow>[]>(
    () => [
      {
        accessorKey: "clientName",
        header: "Cliente",
        minSize: 220,
        size: 260,
        cell: ({ row }) => (
          <Tooltip>
            <Tooltip.Trigger>
              <span className="block max-w-72 truncate">{row.original.clientName}</span>
            </Tooltip.Trigger>
            <Tooltip.Content>{row.original.clientName}</Tooltip.Content>
          </Tooltip>
        ),
      },
      {
        accessorKey: "clientRUT",
        header: "RUT",
      },
      {
        accessorKey: "folioLabel",
        header: "Referencia",
      },
      {
        accessorKey: "totalAmount",
        header: "Total",
        cell: ({ row }) => currencyFormatter.format(row.original.totalAmount),
      },
      {
        accessorKey: "confidenceScore",
        header: "Score",
        cell: ({ row }) => <span className="font-semibold">{row.original.confidenceScore}</span>,
      },
      {
        accessorKey: "matchedBy",
        header: "Método",
      },
      {
        id: "warnings",
        header: "Alertas",
        cell: ({ row }) => {
          const warnings = warningReasons(row.original.reasons);
          if (warnings.length === 0) return null;
          return (
            <Tooltip>
              <Tooltip.Trigger>
                <Chip color="warning" size="sm" variant="soft">
                  {warnings.length === 1 ? "Advertencia" : `${warnings.length} alertas`}
                </Chip>
              </Tooltip.Trigger>
              <Tooltip.Content className="max-w-sm">
                <div className="space-y-1">
                  {warnings.map((warning) => (
                    <p key={warning}>{warning}</p>
                  ))}
                </div>
              </Tooltip.Content>
            </Tooltip>
          );
        },
        size: 140,
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => (
          <div className="text-right">
            <Button
              isPending={confirmMutation.isPending}
              size="sm"
              variant="primary"
              onPress={() => confirmMutation.mutate(row.original)}
            >
              Vincular
            </Button>
          </div>
        ),
      },
    ],
    [confirmMutation]
  );

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
              <div className="rounded-lg border border-default-200 p-3">
                <p className="font-semibold text-sm">{event?.summary ?? "(Sin título)"}</p>
                <p className="text-default-500 text-xs">
                  {event?.description ?? "Sin descripción"}
                </p>
              </div>

              {series ? (
                <div className="space-y-3 rounded-lg border border-primary/20 bg-primary/5 p-3">
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
                    <div className="rounded-lg border border-default-200 bg-background p-3">
                      <p className="mb-2 font-semibold text-xs uppercase tracking-wide text-default-600">
                        Eventos de la serie
                      </p>
                      <div className="space-y-2 text-xs">
                        {series.events.map((seriesEvent) => (
                          <div
                            className="flex items-center justify-between gap-2"
                            key={`${seriesEvent.calendarGoogleId}-${seriesEvent.externalEventId}`}
                          >
                            <div className="min-w-0">
                              <p className="truncate font-medium">
                                {seriesEvent.seriesStageLabel ?? seriesEvent.summary ?? "Evento"}
                              </p>
                              <p className="truncate text-default-500">
                                {seriesEvent.eventDate}
                                {seriesEvent.summary ? ` · ${seriesEvent.summary}` : ""}
                              </p>
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
                    </div>

                    <div className="rounded-lg border border-default-200 bg-background p-3">
                      <p className="mb-2 font-semibold text-xs uppercase tracking-wide text-default-600">
                        Documentos ya vinculados
                      </p>
                      <div className="space-y-2 text-xs">
                        {series.linkedDocuments.length === 0 ? (
                          <p className="text-default-500">
                            Todavía no hay DTE asociados a esta serie.
                          </p>
                        ) : (
                          series.linkedDocuments.map((doc) => (
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
                    </div>
                  </div>

                  <Description className="text-default-600">
                    Las sugerencias consideran toda la ventana de la serie (
                    {series.eligibleDocumentDateFrom} a {series.eligibleDocumentDateTo}) y excluyen
                    DTE ya vinculados dentro del mismo cluster.
                  </Description>
                </div>
              ) : null}

              {suggestionsQuery.isError ? (
                <Description className="text-danger">
                  No se pudieron cargar sugerencias.
                </Description>
              ) : null}

              {suggestionsQuery.data?.linked ? (
                <div className="flex items-center justify-between rounded-lg border border-success-200 bg-success-50/40 p-3">
                  <Description className="text-success-700">
                    Este evento ya tiene un vínculo confirmado.
                  </Description>
                  <Button
                    isPending={unlinkMutation.isPending}
                    size="sm"
                    variant="danger"
                    onPress={() => unlinkMutation.mutate()}
                  >
                    Desvincular
                  </Button>
                </div>
              ) : null}

              {isPendingEmission && !suggestionsQuery.data?.linked ? (
                <div className="rounded-lg border border-warning-200 bg-warning-50/40 p-3">
                  <Description className="text-warning-700">
                    Evento en fecha futura. El vínculo DTE se habilita cuando llegue la fecha de
                    emisión.
                  </Description>
                </div>
              ) : null}

              <DataTable
                autoFitColumns={false}
                columns={suggestionColumns}
                containerVariant="plain"
                data={candidates}
                enableGlobalFilter={false}
                enablePagination={false}
                enableToolbar={false}
                isLoading={!isPendingEmission && suggestionsQuery.isLoading}
                noDataMessage={
                  isPendingEmission
                    ? "Evento pendiente de emisión: aún no se muestran candidatos."
                    : "Sin candidatos para este día."
                }
                scrollMaxHeight="min(50dvh, 420px)"
                scrollMode="container"
              />
            </Modal.Body>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
