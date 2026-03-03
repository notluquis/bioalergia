import { Button, Description, Modal } from "@heroui/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import dayjs from "dayjs";
import { useMemo } from "react";
import { DataTable } from "@/components/data-table/DataTable";
import { useToast } from "@/context/ToastContext";
import {
  confirmEventDteLink,
  fetchEventDteSuggestions,
  unlinkEventDteLink,
} from "@/features/calendar/api";
import type { CalendarEventDetail, EventDteSuggestion } from "@/features/calendar/types";
import { currencyFormatter } from "@/lib/format";

interface EventDteLinkModalProps {
  event: CalendarEventDetail | null;
  isOpen: boolean;
  onClose: () => void;
  onLinked: () => void;
}

export function EventDteLinkModal({ event, isOpen, onClose, onLinked }: EventDteLinkModalProps) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const today = dayjs().format("YYYY-MM-DD");
  const isPendingEmission = Boolean(event?.eventDate && event.eventDate > today);

  const suggestionsQuery = useQuery({
    enabled: isOpen && Boolean(event?.calendarId && event?.eventId) && !isPendingEmission,
    queryFn: () =>
      fetchEventDteSuggestions({
        calendarId: event?.calendarId ?? "",
        eventId: event?.eventId ?? "",
        limit: 12,
      }),
    queryKey: ["calendar", "dte-link", "suggestions", event?.calendarId, event?.eventId],
  });

  const confirmMutation = useMutation({
    mutationFn: (candidate: EventDteSuggestion) =>
      confirmEventDteLink({
        calendarId: event?.calendarId ?? "",
        confidenceScore: candidate.confidenceScore,
        dteSaleDetailId: candidate.dteSaleDetailId,
        eventId: event?.eventId ?? "",
        matchedBy: candidate.method,
        matchedName: candidate.clientName,
        matchedRUT: candidate.clientRUT,
      }),
    onSuccess: async () => {
      toast.success("Vínculo DTE confirmado");
      await queryClient.invalidateQueries({ queryKey: ["calendar", "dte-link", "by-day"] });
      await queryClient.invalidateQueries({
        queryKey: ["calendar", "dte-link", "suggestions", event?.calendarId, event?.eventId],
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
      await queryClient.invalidateQueries({ queryKey: ["calendar", "dte-link", "by-day"] });
      onLinked();
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "No se pudo eliminar vínculo");
    },
  });

  const candidates = useMemo(
    () => suggestionsQuery.data?.suggestions ?? [],
    [suggestionsQuery.data],
  );

  const suggestionColumns = useMemo<ColumnDef<EventDteSuggestion>[]>(
    () => [
      {
        accessorKey: "clientName",
        header: "Cliente",
        minSize: 220,
        size: 260,
        cell: ({ row }) => (
          <span className="block max-w-72 truncate" title={row.original.clientName}>
            {row.original.clientName}
          </span>
        ),
      },
      {
        accessorKey: "clientRUT",
        header: "RUT",
      },
      {
        accessorKey: "folio",
        header: "Folio",
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
        accessorKey: "method",
        header: "Método",
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
    [confirmMutation.isPending, confirmMutation.mutate],
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
