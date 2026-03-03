import { Description, Modal, Spinner } from "@heroui/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { Button } from "@/components/ui/Button";
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

  const suggestionsQuery = useQuery({
    enabled: isOpen && Boolean(event?.calendarId && event?.eventId),
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

  return (
    <Modal>
      <Modal.Backdrop isOpen={isOpen} onOpenChange={(open) => !open && onClose()} variant="blur">
        <Modal.Container placement="center" size="lg">
          <Modal.Dialog>
            <Modal.CloseTrigger />
            <Modal.Header>
              <Modal.Heading>Vincular evento con boleta DTE</Modal.Heading>
            </Modal.Header>
            <Modal.Body className="space-y-3">
              <div className="rounded-lg border border-default-200 p-3">
                <p className="font-semibold text-sm">{event?.summary ?? "(Sin título)"}</p>
                <p className="text-default-500 text-xs">
                  {event?.description ?? "Sin descripción"}
                </p>
              </div>

              {suggestionsQuery.isLoading ? (
                <div className="flex items-center gap-2 py-6 text-default-500">
                  <Spinner size="sm" />
                  Buscando sugerencias...
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
                    color="danger"
                    isLoading={unlinkMutation.isPending}
                    size="sm"
                    variant="ghost"
                    onPress={() => unlinkMutation.mutate()}
                  >
                    Desvincular
                  </Button>
                </div>
              ) : null}

              <div className="max-h-[50vh] overflow-y-auto rounded-lg border border-default-200">
                {candidates.length === 0 && !suggestionsQuery.isLoading ? (
                  <div className="p-4 text-center text-default-500 text-sm">
                    Sin candidatos para este día.
                  </div>
                ) : (
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-default-50">
                      <tr className="text-left text-default-600 text-xs uppercase">
                        <th className="px-3 py-2">Cliente</th>
                        <th className="px-3 py-2">RUT</th>
                        <th className="px-3 py-2">Folio</th>
                        <th className="px-3 py-2">Total</th>
                        <th className="px-3 py-2">Score</th>
                        <th className="px-3 py-2">Método</th>
                        <th className="px-3 py-2" />
                      </tr>
                    </thead>
                    <tbody>
                      {candidates.map((candidate) => (
                        <tr className="border-default-100 border-t" key={candidate.dteSaleDetailId}>
                          <td className="px-3 py-2">{candidate.clientName}</td>
                          <td className="px-3 py-2">{candidate.clientRUT}</td>
                          <td className="px-3 py-2">{candidate.folio}</td>
                          <td className="px-3 py-2">
                            {currencyFormatter.format(candidate.totalAmount)}
                          </td>
                          <td className="px-3 py-2 font-semibold">{candidate.confidenceScore}</td>
                          <td className="px-3 py-2">{candidate.method}</td>
                          <td className="px-3 py-2 text-right">
                            <Button
                              color="primary"
                              isLoading={confirmMutation.isPending}
                              size="sm"
                              variant="ghost"
                              onPress={() => confirmMutation.mutate(candidate)}
                            >
                              Vincular
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </Modal.Body>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
