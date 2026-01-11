import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Copy, ExternalLink, Key, Loader2, LogOut, ShieldCheck, X } from "lucide-react";
import { useState } from "react";

import Button from "@/components/ui/Button";
import { useToast } from "@/context/ToastContext";
import { apiClient } from "@/lib/apiClient";
import { cn } from "@/lib/utils";

interface GoogleStatus {
  configured: boolean;
  source: "db" | "env" | "none";
}

interface AuthUrlResponse {
  url: string;
}

export default function GoogleDriveConnect() {
  const { success, error: showError } = useToast();
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [authCode, setAuthCode] = useState("");

  // Status Query
  const statusQuery = useQuery({
    queryKey: ["google-status"],
    queryFn: async () => {
      return apiClient.get<GoogleStatus>("/api/integrations/google/status");
    },
  });

  // Get Auth URL Mutation
  const getUrlMutation = useMutation({
    mutationFn: async () => {
      return apiClient.get<AuthUrlResponse>("/api/integrations/google/url");
    },
    onSuccess: (data) => {
      // Open URL in new tab
      window.open(data.url, "_blank");
      setIsModalOpen(true);
    },
    onError: (e) => showError(e.message),
  });

  // Connect Mutation
  const connectMutation = useMutation({
    mutationFn: async (code: string) => {
      return apiClient.post("/api/integrations/google/connect", { code });
    },
    onSuccess: () => {
      success("Conectado exitosamente con Google Drive");
      setIsModalOpen(false);
      setAuthCode("");
      queryClient.invalidateQueries({ queryKey: ["google-status"] });
    },
    onError: (e) => showError(e.message),
  });

  // Disconnect Mutation
  const disconnectMutation = useMutation({
    mutationFn: async () => {
      return apiClient.delete("/api/integrations/google/disconnect");
    },
    onSuccess: () => {
      success("Desconectado de Google Drive");
      queryClient.invalidateQueries({ queryKey: ["google-status"] });
    },
    onError: (e) => showError(e.message),
  });

  const isConfigured = statusQuery.data?.configured;
  const isEnv = statusQuery.data?.source === "env";

  if (statusQuery.isLoading) {
    return (
      <div className="bg-base-200/50 flex items-center justify-center rounded-xl p-8">
        <Loader2 className="text-primary size-6 animate-spin" />
      </div>
    );
  }

  return (
    <>
      <div className="bg-base-200/50 rounded-xl p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div
              className={cn(
                "rounded-xl p-3",
                isConfigured ? "bg-success/10 text-success" : "bg-base-content/5 text-base-content/40"
              )}
            >
              <ShieldCheck className="size-6" />
            </div>
            <div>
              <h3 className="font-semibold">Conexión Google Drive</h3>
              <p className="text-base-content/60 text-sm">
                {(() => {
                  if (!isConfigured) return "No conectado. Los backups a la nube podrían fallar.";
                  const sourceText = isEnv ? "Configuración estática ENV" : "Gestionado por Servidor";
                  return `Conectado y listo para backups (${sourceText}).`;
                })()}
              </p>
            </div>
          </div>

          <div className="flex gap-2">
            {isConfigured ? (
              <Button
                variant="outline"
                disabled={isEnv || disconnectMutation.isPending}
                onClick={() => {
                  if (
                    confirm("¿Estás seguro de desconectar Google Drive? Los backups automáticos dejarán de funcionar.")
                  ) {
                    disconnectMutation.mutate();
                  }
                }}
                className="hover:bg-error/10 hover:text-error hover:border-error gap-2"
                title={
                  isEnv
                    ? "No se puede desconectar porque está configurado por variables de entorno"
                    : "Desconectar cuenta"
                }
              >
                <LogOut className="size-4" />
                {isEnv ? "Gestionado por ENV" : "Desconectar"}
              </Button>
            ) : (
              <Button
                variant="primary"
                onClick={() => getUrlMutation.mutate()}
                isLoading={getUrlMutation.isPending}
                className="gap-2"
              >
                <Key className="size-4" />
                Conectar
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Auth Code Modal */}
      {isModalOpen && (
        <div className="bg-base-content/80 fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-base-100 w-full max-w-md space-y-4 rounded-xl p-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold">Completar Conexión</h3>
              <button onClick={() => setIsModalOpen(false)} className="btn btn-circle btn-ghost btn-sm">
                <X className="size-4" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="bg-info/10 text-info rounded-lg p-3 text-sm">
                <p>1. Se ha abierto una ventana de Google.</p>
                <p>2. Inicia sesión y autoriza la aplicación.</p>
                <p>3. Copia el código que te muestra Google y pégalo abajo.</p>
              </div>

              <div className="form-control">
                <label className="label" htmlFor="auth-code-input">
                  <span className="label-text">Código de Autorización</span>
                </label>
                <div className="flex gap-2">
                  <input
                    id="auth-code-input"
                    type="text"
                    className="input input-bordered w-full font-mono text-sm"
                    placeholder="Pegar código aquí (4/0A...)"
                    value={authCode}
                    onChange={(e) => setAuthCode(e.target.value)}
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={async () => {
                      try {
                        const text = await navigator.clipboard.readText();
                        setAuthCode(text);
                      } catch {
                        showError("No se pudo leer del portapapeles");
                      }
                    }}
                    title="Pegar del portapapeles"
                  >
                    <Copy className="size-4" />
                  </Button>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" onClick={() => setIsModalOpen(false)}>
                Cancelar
              </Button>
              <Button
                variant="primary"
                onClick={() => connectMutation.mutate(authCode)}
                isLoading={connectMutation.isPending}
                disabled={!authCode}
              >
                Confirmar <Check className="ml-2 size-4" />
              </Button>
            </div>

            <div className="text-center">
              <button
                onClick={() => getUrlMutation.mutate()}
                className="text-primary inline-flex items-center gap-1 text-xs hover:underline"
              >
                No se abrió la ventana? Click aquí <ExternalLink className="size-3" />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
