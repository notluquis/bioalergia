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
      () => resolve(null),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 8_000 }
    );
  });
}

type NavigatorConnection = { type?: string; effectiveType?: string; downlink?: number };

function getNetworkInfo(): { connectionType?: string; downlinkMbps?: number } {
  const nav = navigator as unknown as {
    connection?: NavigatorConnection;
    mozConnection?: NavigatorConnection;
    webkitConnection?: NavigatorConnection;
  };
  const conn = nav.connection ?? nav.mozConnection ?? nav.webkitConnection;
  if (!conn) return {};
  return {
    connectionType: conn.type ?? conn.effectiveType ?? undefined,
    downlinkMbps: conn.downlink ?? undefined,
  };
}

function getDeviceInfo(): {
  isMobile: boolean;
  clientTimezone: string;
  deviceRam?: number;
  cpuCores?: number;
  screenResolution: string;
  devicePixelRatio: number;
} {
  const nav = navigator as Navigator & { deviceMemory?: number };
  const dpr = window.devicePixelRatio ?? 1;
  return {
    isMobile: navigator.maxTouchPoints > 0,
    clientTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    deviceRam: nav.deviceMemory ?? undefined,
    cpuCores: navigator.hardwareConcurrency ?? undefined,
    screenResolution: `${screen.width}x${screen.height}@${dpr}x`,
    devicePixelRatio: dpr,
  };
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

      const network = getNetworkInfo();
      const device = getDeviceInfo();

      return attendanceORPCClient.mark({
        accuracyMeters: position?.coords.accuracy,
        latitude: position?.coords.latitude,
        longitude: position?.coords.longitude,
        type: markType,
        ...network,
        ...device,
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
