import { Alert, Button } from "@heroui/react";
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
      { enableHighAccuracy: true, maximumAge: 0, timeout: 8_000 }
    );
  });
}

/** Capture network connection type if available (Network Information API) */
function getConnectionType(): string | undefined {
  const nav = navigator as unknown as {
    connection?: { type?: string; effectiveType?: string };
    mozConnection?: { type?: string; effectiveType?: string };
    webkitConnection?: { type?: string; effectiveType?: string };
  };
  const conn = nav.connection ?? nav.mozConnection ?? nav.webkitConnection;
  return conn?.type ?? conn?.effectiveType ?? undefined;
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
        accuracyMeters: position?.coords.accuracy,
        connectionType: getConnectionType(),
        latitude: position?.coords.latitude,
        longitude: position?.coords.longitude,
        type: markType,
      });
    },
    onError: (error) => {
      const apiError = toAttendanceApiError(error);
      console.error("[attendance] mark error:", apiError.message);
    },
    onSuccess: (data) => {
      onSuccess(data.mark);
      void queryClient.invalidateQueries({ queryKey: ["attendance", "status"] });
    },
  });

  return (
    <div className="flex flex-col gap-2">
      <Button
        className="w-full"
        isDisabled={mutation.isPending}
        onPress={() => mutation.mutate()}
        variant={markType === "CLOCK_IN" ? "primary" : "danger"}
      >
        {mutation.isPending ? "Registrando..." : label}
      </Button>

      {gpsError && (
        <Alert status="warning">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Description>
              GPS no disponible — marca registrada sin ubicación.
            </Alert.Description>
          </Alert.Content>
        </Alert>
      )}

      {mutation.isError && (
        <Alert status="danger">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Description>{toAttendanceApiError(mutation.error).message}</Alert.Description>
          </Alert.Content>
        </Alert>
      )}

      {mutation.isSuccess && (
        <Alert status="success">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Description>¡Marca registrada correctamente!</Alert.Description>
          </Alert.Content>
        </Alert>
      )}
    </div>
  );
}
