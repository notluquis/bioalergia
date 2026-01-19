import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiClient } from "../../../lib/api-client";

export function useCalendarSync() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const response = await apiClient.post("/api/calendar/events/sync");
      return response.data;
    },
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
    onError: (error: any) => {
      toast.error("Error al sincronizar", {
        description: error.message || "Ocurrió un error inesperado.",
      });
    },
  });
}
