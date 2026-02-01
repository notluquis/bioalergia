import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiClient } from "../../../lib/api-client";
import { CalendarSyncResponseSchema } from "../schemas";

export function useCalendarSync() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async () => {
      // Pass empty object as body
      const response = await apiClient.post<{
        logId: number;
        message: string;
        status: "accepted";
      }>("/api/calendar/events/sync", {}, { responseSchema: CalendarSyncResponseSchema });
      return response;
    },
    // biome-ignore lint/suspicious/noExplicitAny: react query
    onSuccess: (data: any) => {
      toast.success("Sincronización iniciada", {
        description: data.message || "La sincronización se está ejecutando en segundo plano.",
      });
      // Invalidate queries to refresh UI eventually
      // Since it's async, immediate invalidation might not show changes,
      // but it's good practice. Real-time updates would need WebSocket/Polling.
      queryClient.invalidateQueries({ queryKey: ["calendar-events"] });
      queryClient.invalidateQueries({ queryKey: ["calendar-sync-logs"] });
    },
    // biome-ignore lint/suspicious/noExplicitAny: react query
    onError: (error: any) => {
      toast.error("Error al sincronizar", {
        description: error.message || "Ocurrió un error inesperado.",
      });
    },
  });

  return {
    syncNow: mutation.mutate,
    syncing: mutation.isPending,
    ...mutation,
  };
}
