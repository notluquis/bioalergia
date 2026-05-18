import { Alert, Button, Card, Chip, Spinner } from "@heroui/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link2, LogOut, RefreshCw } from "lucide-react";
import { useEffect } from "react";

import { useToast } from "@/context/ToastContext";
import { mlORPCClient } from "../orpc-ml";

const STATUS_QUERY_KEY = ["ml", "status"] as const;

export function MlConnectionPage() {
  const queryClient = useQueryClient();
  const { success: toastSuccess, error: toastError } = useToast();

  const { data, isLoading } = useQuery({
    queryKey: STATUS_QUERY_KEY,
    queryFn: () => mlORPCClient.status(),
  });

  // Mensajes de OAuth callback (querystring).
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("ml_connected") === "1") {
      toastSuccess("MercadoLibre conectado correctamente");
      void queryClient.invalidateQueries({ queryKey: STATUS_QUERY_KEY });
      window.history.replaceState({}, "", window.location.pathname);
    }
    const err = params.get("ml_error");
    if (err) {
      toastError(`Error ML: ${err}`);
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, [queryClient, toastError, toastSuccess]);

  const connectMutation = useMutation({
    mutationFn: () => mlORPCClient.connect(),
    onSuccess: (res) => {
      window.location.href = res.data.authorization_url;
    },
    onError: (e) => toastError(e instanceof Error ? e.message : "No se pudo iniciar OAuth"),
  });

  const disconnectMutation = useMutation({
    mutationFn: () => mlORPCClient.disconnect(),
    onSuccess: () => {
      toastSuccess("MercadoLibre desconectado");
      void queryClient.invalidateQueries({ queryKey: STATUS_QUERY_KEY });
    },
    onError: (e) => toastError(e instanceof Error ? e.message : "No se pudo desconectar"),
  });

  const connected = data?.data.connected === true;

  return (
    <section className="space-y-6">
      <Card>
        <Card.Header>
          <Card.Title>MercadoLibre Chile</Card.Title>
          <Card.Description>
            Conecta tu cuenta vendedor MLC vía OAuth2. Los tokens se almacenan encriptados
            (AES-256-GCM) y se renuevan automáticamente.
          </Card.Description>
        </Card.Header>
        <Card.Content className="space-y-4">
          {isLoading ? (
            <div className="flex items-center gap-2 text-foreground/60 text-sm">
              <Spinner size="sm" /> Cargando estado…
            </div>
          ) : connected && data.data.connected ? (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-3">
                <Chip variant="primary">Conectado</Chip>
                <span className="text-sm">
                  Seller ID: <span className="font-mono">{data.data.ml_user_id}</span>
                </span>
                <span className="text-foreground/60 text-xs">
                  Token expira: {data.data.expires_at.toLocaleString("es-CL")}
                </span>
              </div>
              {data.data.scope && (
                <p className="text-foreground/60 text-xs">
                  Scopes: <span className="font-mono">{data.data.scope}</span>
                </p>
              )}
            </div>
          ) : (
            <Alert status="warning">
              <Alert.Content>
                <Alert.Description>
                  Sin cuenta conectada. Conecta para poder publicar productos a MercadoLibre.
                </Alert.Description>
              </Alert.Content>
            </Alert>
          )}
        </Card.Content>
        <Card.Footer className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-end">
          {connected && (
            <Button
              isDisabled={disconnectMutation.isPending}
              onPress={() => {
                if (confirm("¿Desconectar MercadoLibre?")) {
                  disconnectMutation.mutate();
                }
              }}
              variant="danger-soft"
            >
              <LogOut size={16} /> Desconectar
            </Button>
          )}
          <Button
            isDisabled={connectMutation.isPending}
            onPress={() => connectMutation.mutate()}
            variant="primary"
          >
            {connectMutation.isPending ? <Spinner size="sm" /> : <Link2 size={16} />}
            {connected ? "Reconectar" : "Conectar MercadoLibre"}
          </Button>
        </Card.Footer>
      </Card>

      <Card variant="secondary">
        <Card.Header>
          <Card.Title>¿Cómo funciona?</Card.Title>
        </Card.Header>
        <Card.Content className="space-y-2 text-sm">
          <p>
            <RefreshCw className="-mt-1 mr-1 inline" size={14} />
            Cuando publiques un producto a ML, se actualiza una vez. El inventario se sincroniza
            después de cada venta web.
          </p>
          <p>
            La categoría ML se predice automáticamente la primera vez. Quedará cacheada para
            productos de la misma categoría local.
          </p>
        </Card.Content>
      </Card>
    </section>
  );
}
