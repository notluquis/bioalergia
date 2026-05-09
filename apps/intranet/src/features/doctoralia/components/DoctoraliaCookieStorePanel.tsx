import {
  Alert,
  Button,
  Card,
  Chip,
  Kbd,
  Label,
  Spinner,
  Surface,
  TextArea,
  TextField,
} from "@heroui/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";
import { Cookie, Save } from "lucide-react";
import { useMemo, useState } from "react";

import { useToast } from "@/context/ToastContext";
import { fetchDoctoraliaScraperCookiesStatus, updateDoctoraliaScraperCookies } from "../api";

const COOKIES_QUERY_KEY = ["doctoralia", "scraper", "cookies", "status"];

function formatRelative(date: Date | null): string {
  if (!date) return "—";
  return dayjs(date).fromNow();
}

function formatDate(date: Date | null): string {
  if (!date) return "—";
  return dayjs(date).tz().format("D MMM YYYY, HH:mm");
}

export function DoctoraliaCookieStorePanel() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [cookieHeader, setCookieHeader] = useState("");

  const { data: status, isLoading } = useQuery({
    queryFn: fetchDoctoraliaScraperCookiesStatus,
    queryKey: COOKIES_QUERY_KEY,
  });

  const saveMutation = useMutation({
    mutationFn: (cookieHeaderValue: string) =>
      updateDoctoraliaScraperCookies({ cookieHeader: cookieHeaderValue }),
    onSuccess: (data) => {
      toast.success(
        `Se guardaron ${data.count} cookie${data.count === 1 ? "" : "s"}.`,
        "Cookies actualizadas"
      );
      setCookieHeader("");
      void queryClient.invalidateQueries({ queryKey: COOKIES_QUERY_KEY });
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : "Error inesperado";
      toast.error(message, "No se pudieron guardar las cookies");
    },
  });

  const trimmed = cookieHeader.trim();
  const disabled = saveMutation.isPending || trimmed.length === 0;

  const previewCount = useMemo(() => {
    if (!trimmed) return 0;
    return trimmed.split(/;\s*/).filter((p) => {
      const eq = p.indexOf("=");
      return eq > 0 && p.slice(0, eq).trim().length > 0;
    }).length;
  }, [trimmed]);

  return (
    <Card>
      <Card.Header className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <Surface className="rounded-xl bg-primary/10 p-2 text-primary">
            <Cookie className="h-5 w-5" />
          </Surface>
          <div className="space-y-1">
            <Card.Title className="text-sm">Cookies del bot scraper</Card.Title>
            <Card.Description className="text-default-500 text-xs">
              Pega aquí el header{" "}
              <Kbd>
                <Kbd.Content>Cookie</Kbd.Content>
              </Kbd>{" "}
              del panel de Doctoralia (DevTools → Network → copia como cURL → extrae la línea{" "}
              <Kbd>
                <Kbd.Content>Cookie: …</Kbd.Content>
              </Kbd>
              ). El bot las usará en su próxima corrida.
            </Card.Description>
          </div>
        </div>
        {status?.exists ? (
          <Chip color="success" size="sm" variant="soft">
            {status.count} cookie{status.count === 1 ? "" : "s"}
          </Chip>
        ) : (
          <Chip color="warning" size="sm" variant="soft">
            Sin cookies
          </Chip>
        )}
      </Card.Header>

      <Card.Content className="space-y-4">
        {isLoading ? (
          <div className="flex items-center gap-2 text-default-500 text-sm">
            <Spinner size="sm" />
            <span>Cargando estado…</span>
          </div>
        ) : status?.exists ? (
          <div className="grid grid-cols-2 gap-3">
            <Surface className="rounded-2xl border border-default-200 px-4 py-3">
              <p className="font-semibold text-[11px] text-default-400 uppercase tracking-wide">
                Actualizado
              </p>
              <p className="mt-1 font-medium text-sm">{formatDate(status.updatedAt)}</p>
            </Surface>
            <Surface className="rounded-2xl border border-default-200 px-4 py-3">
              <p className="font-semibold text-[11px] text-default-400 uppercase tracking-wide">
                Último uso del bot
              </p>
              <p className="mt-1 font-medium text-sm">{formatRelative(status.lastUsedAt)}</p>
            </Surface>
            <Surface className="col-span-2 rounded-2xl border border-default-200 px-4 py-3">
              <p className="font-semibold text-[11px] text-default-400 uppercase tracking-wide">
                Actualizado por
              </p>
              <p className="mt-1 font-medium text-sm">{status.updatedByEmail ?? "—"}</p>
            </Surface>
          </div>
        ) : (
          <Alert status="warning">
            <Alert.Indicator />
            <Alert.Content>
              <Alert.Title>Sin cookies guardadas</Alert.Title>
              <Alert.Description>
                Pega el header para que el bot pueda autenticarse en su próxima corrida.
              </Alert.Description>
            </Alert.Content>
          </Alert>
        )}

        <TextField value={cookieHeader} onChange={setCookieHeader}>
          <Label>Cookie header</Label>
          <TextArea
            variant="secondary"
            placeholder="PHPSESSID=…; XSRF-TOKEN=…; csrf=…"
            rows={4}
            spellCheck={false}
            autoComplete="off"
            className="font-mono text-xs"
          />
        </TextField>
      </Card.Content>

      <Card.Footer className="flex items-center justify-between">
        <p className="text-default-400 text-xs">
          {previewCount > 0
            ? `${previewCount} cookie${previewCount === 1 ? "" : "s"} detectadas`
            : "Aún no se detectan cookies"}
        </p>
        <Button
          variant="primary"
          size="sm"
          isDisabled={disabled}
          isPending={saveMutation.isPending}
          onPress={() => saveMutation.mutate(trimmed)}
        >
          <Save className="h-3.5 w-3.5" />
          {saveMutation.isPending ? "Guardando…" : "Guardar cookies"}
        </Button>
      </Card.Footer>
    </Card>
  );
}
