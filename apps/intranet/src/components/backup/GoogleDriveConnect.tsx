import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { Key, Loader2, LogOut, ShieldCheck } from "lucide-react";
import { Suspense, useEffect } from "react";
import { z } from "zod";

import { Button } from "@/components/ui/Button";
import { useToast } from "@/context/ToastContext";
import { apiClient } from "@/lib/api-client";
import { cn } from "@/lib/utils";

interface AuthUrlResponse {
  url: string;
}

interface GoogleStatus {
  configured: boolean;
  error?: string;
  errorCode?: "invalid_grant" | "token_expired" | "token_revoked" | "unknown";
  source: "db" | "env" | "none";
  valid: boolean;
}

const GoogleStatusSchema = z.object({
  configured: z.boolean(),
  error: z.string().optional(),
  errorCode: z.enum(["invalid_grant", "token_expired", "token_revoked", "unknown"]).optional(),
  source: z.enum(["db", "env", "none"]),
  valid: z.boolean(),
});

const AuthUrlResponseSchema = z.object({
  url: z.url(),
});

const DisconnectResponseSchema = z.looseObject({
  status: z.string().optional(),
  message: z.string().optional(),
});

// Error message mapping for user-friendly display
const ERROR_MESSAGES: Record<string, string> = {
  access_denied: "Acceso denegado. El usuario canceló la autorización.",
  invalid_state: "Error de seguridad. Intenta conectar nuevamente.",
  missing_code: "No se recibió código de autorización.",
  no_refresh_token: "Google no proporcionó token. Revoca el acceso y vuelve a intentar.",
  token_exchange_failed: "Error al intercambiar código. Intenta nuevamente.",
};
export function GoogleDriveConnectWrapper() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center rounded-xl bg-default-50/50 p-8">
          <Loader2 className="size-6 animate-spin text-primary" />
        </div>
      }
    >
      <GoogleDriveConnect />
    </Suspense>
  );
}

export { GoogleDriveConnectWrapper as GoogleDriveConnect };

function GoogleDriveConnect() {
  const { error: showError, success } = useToast();
  const queryClient = useQueryClient();

  // Handle callback results from URL params
  useEffect(() => {
    const searchParams = new URLSearchParams(globalThis.location.search);
    const connected = searchParams.get("connected");
    const error = searchParams.get("error");

    if (connected === "true") {
      success("¡Conectado exitosamente con Google Drive!");
      // Clean URL
      const url = new URL(globalThis.location.href);
      url.searchParams.delete("connected");
      globalThis.history.replaceState({}, "", url.pathname + url.search);
      // Refresh status
      void queryClient.invalidateQueries({ queryKey: ["google-status"] });
    }

    if (error) {
      const errorMessage = Object.hasOwn(ERROR_MESSAGES, error)
        ? // eslint-disable-next-line security/detect-object-injection, @typescript-eslint/no-non-null-assertion
          // biome-ignore lint/style/noNonNullAssertion: legacy logic
          ERROR_MESSAGES[error]!
        : `Error de conexión: ${error}`;
      showError(errorMessage);
      // Clean URL
      const url = new URL(globalThis.location.href);
      url.searchParams.delete("error");
      globalThis.history.replaceState({}, "", url.pathname + url.search);
    }
  }, [success, showError, queryClient]);

  // Status Query
  const { data: status } = useSuspenseQuery({
    queryFn: async () => {
      return apiClient.get<GoogleStatus>("/api/integrations/google/status", {
        responseSchema: GoogleStatusSchema,
      });
    },
    queryKey: ["google-status"],
  });

  // Get Auth URL and redirect (no modal needed!)
  const connectMutation = useMutation({
    mutationFn: async () => {
      return apiClient.get<AuthUrlResponse>("/api/integrations/google/url", {
        responseSchema: AuthUrlResponseSchema,
      });
    },
    onError: (e) => {
      showError(e.message);
    },
    onSuccess: (data) => {
      // Redirect to Google in same window (not popup/new tab)
      // The callback will redirect back to this page
      globalThis.location.assign(data.url);
    },
  });

  // Disconnect Mutation
  const disconnectMutation = useMutation({
    mutationFn: async () => {
      return apiClient.delete("/api/integrations/google/disconnect", {
        responseSchema: DisconnectResponseSchema,
      });
    },
    onError: (e) => {
      showError(e.message);
    },
    onSuccess: () => {
      success("Desconectado de Google Drive");
      void queryClient.invalidateQueries({ queryKey: ["google-status"] });
    },
  });

  const isConfigured = status.configured;
  const isEnv = status.source === "env";

  // Helper function to get icon styling based on status
  const getIconClassName = (): string => {
    if (isConfigured && status.valid) {
      return "bg-success/10 text-success";
    }
    if (isConfigured && !status.valid) {
      return "bg-warning/10 text-warning";
    }
    return "bg-default-50 text-default-300";
  };

  // Helper function to get status message
  const getStatusMessage = (): React.JSX.Element => {
    const isValid = status.valid;
    const errorMsg = status.error;
    const sourceText = isEnv ? "Configuración estática ENV" : "Gestionado por Servidor";

    if (!isConfigured) {
      return <span>No conectado. Los backups a la nube podrían fallar.</span>;
    }
    if (!isValid) {
      return (
        <span className="text-warning">
          ⚠️ {errorMsg ?? "Token inválido. Reconecta Google Drive."}
        </span>
      );
    }
    return <span>✓ Conectado y listo para backups ({sourceText}).</span>;
  };

  return (
    <div className="rounded-xl bg-default-50/50 p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className={cn("rounded-xl p-3", getIconClassName())}>
            <ShieldCheck className="size-6" />
          </div>
          <div>
            <h3 className="font-semibold">Conexión Google Drive</h3>
            <p className="text-default-500 text-sm">{getStatusMessage()}</p>
          </div>
        </div>

        <div className="flex gap-2">
          {isConfigured ? (
            <>
              {!status.valid && (
                <Button
                  className="gap-2"
                  isLoading={connectMutation.isPending}
                  onClick={() => {
                    connectMutation.mutate();
                  }}
                  variant="primary"
                >
                  <Key className="size-4" />
                  Reconectar
                </Button>
              )}
              <Button
                className="gap-2 hover:border-danger hover:bg-danger/10 hover:text-danger"
                disabled={isEnv || disconnectMutation.isPending}
                onClick={() => {
                  if (
                    confirm(
                      "¿Estás seguro de desconectar Google Drive? Los backups automáticos dejarán de funcionar.",
                    )
                  ) {
                    disconnectMutation.mutate();
                  }
                }}
                title={
                  isEnv
                    ? "No se puede desconectar porque está configurado por variables de entorno"
                    : "Desconectar cuenta"
                }
                variant="outline"
              >
                <LogOut className="size-4" />
                {isEnv ? "Gestionado por ENV" : "Desconectar"}
              </Button>
            </>
          ) : (
            <Button
              className="gap-2"
              isLoading={connectMutation.isPending}
              onClick={() => {
                connectMutation.mutate();
              }}
              variant="primary"
            >
              <Key className="size-4" />
              Conectar
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
