import { Button } from "@heroui/react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import type {
  attendanceMarkSchema,
  attendanceStatusResponseSchema,
} from "@finanzas/orpc-contracts/attendance";
import type { z } from "zod";
import { attendanceORPCClient, toAttendanceApiError } from "./orpc";

type AttendanceStatus = z.infer<typeof attendanceStatusResponseSchema>["currentStatus"];
type AttendanceMark = z.infer<typeof attendanceMarkSchema>;

interface MarkButtonProps {
  currentStatus: AttendanceStatus;
  onSuccess: (mark: AttendanceMark) => void;
}

function getGpsPosition(): Promise<GeolocationPosition | null> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve(null);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve(pos),
      () => resolve(null), // GPS opcional — nunca bloquea
      { enableHighAccuracy: true, timeout: 8_000, maximumAge: 0 }
    );
  });
}

export function MarkButton({ currentStatus, onSuccess }: MarkButtonProps) {
  const queryClient = useQueryClient();
  const [gpsError, setGpsError] = useState(false);

  const markType = currentStatus === "CLOCKED_IN" ? "CLOCK_OUT" : "CLOCK_IN";
  const label = currentStatus === "CLOCKED_IN" ? "Marcar Salida" : "Marcar Entrada";

  const mutation = useMutation({
    mutationFn: async () => {
      setGpsError(false);
      const position = await getGpsPosition();
      if (position === null) setGpsError(true);

      return attendanceORPCClient.mark({
        type: markType,
        latitude: position?.coords.latitude,
        longitude: position?.coords.longitude,
        accuracyMeters: position?.coords.accuracy,
      });
    },
    onSuccess: (data) => {
      onSuccess(data.mark);
      void queryClient.invalidateQueries({ queryKey: ["attendance", "status"] });
    },
    onError: (error) => {
      const apiError = toAttendanceApiError(error);
      console.error("[attendance] mark error:", apiError.message);
    },
  });

  return (
    <div className="flex flex-col items-center gap-2">
      <Button
        variant={markType === "CLOCK_IN" ? "primary" : "danger"}
        className="w-full max-w-xs"
        isDisabled={mutation.isPending}
        onPress={() => mutation.mutate()}
      >
        {mutation.isPending ? "Registrando..." : label}
      </Button>

      {gpsError && (
        <p className="text-xs text-yellow-600">
          GPS no disponible — marca registrada sin ubicación.
        </p>
      )}

      {mutation.isError && (
        <p className="text-xs text-red-500">{toAttendanceApiError(mutation.error).message}</p>
      )}

      {mutation.isSuccess && (
        <p className="text-xs text-green-600">¡Marca registrada correctamente!</p>
      )}
    </div>
  );
}
