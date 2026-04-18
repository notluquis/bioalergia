import { Alert, Button, Card, Chip } from "@heroui/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";
import { Cookie, Loader2, Save } from "lucide-react";
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
  return dayjs(date).format("D MMM YYYY, HH:mm");
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
    <Card className="space-y-4 rounded-2xl border border-default-100 bg-white p-5 shadow-sm">
      <header className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-primary-50 p-2 text-primary-600">
            <Cookie className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-semibold text-default-900 text-sm">Cookies del bot scraper</h3>
            <p className="text-default-500 text-xs">
              Pega aquí el header <code className="rounded bg-default-100 px-1">Cookie</code> del
              panel de Doctoralia (DevTools → Network → copia como cURL → extrae la línea
              <code className="ml-1 rounded bg-default-100 px-1">Cookie: …</code>). El bot las usará
              en su próxima corrida.
            </p>
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
      </header>

      {isLoading ? (
        <div className="flex items-center gap-2 text-default-500 text-sm">
          <Loader2 className="h-4 w-4 animate-spin" />
          Cargando estado…
        </div>
      ) : status?.exists ? (
        <dl className="grid grid-cols-2 gap-3 text-xs">
          <div>
            <dt className="text-default-500">Actualizado</dt>
            <dd className="text-default-900">{formatDate(status.updatedAt)}</dd>
          </div>
          <div>
            <dt className="text-default-500">Último uso del bot</dt>
            <dd className="text-default-900">{formatRelative(status.lastUsedAt)}</dd>
          </div>
          <div className="col-span-2">
            <dt className="text-default-500">Actualizado por</dt>
            <dd className="text-default-900">{status.updatedByEmail ?? "—"}</dd>
          </div>
        </dl>
      ) : (
        <Alert status="warning">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Description>
              Aún no hay cookies guardadas. Pega el header para que el bot pueda autenticarse.
            </Alert.Description>
          </Alert.Content>
        </Alert>
      )}

      <div className="space-y-2">
        <label
          htmlFor="doctoralia-cookie-header"
          className="block font-medium text-default-700 text-xs"
        >
          Cookie header
        </label>
        <textarea
          id="doctoralia-cookie-header"
          value={cookieHeader}
          onChange={(e) => setCookieHeader(e.target.value)}
          placeholder="PHPSESSID=…; XSRF-TOKEN=…; csrf=…"
          rows={4}
          className="w-full resize-y rounded-xl border border-default-200 bg-default-50 px-3 py-2 font-mono text-default-800 text-xs focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100"
          spellCheck={false}
          autoComplete="off"
        />
        <div className="flex items-center justify-between text-default-400 text-xs">
          <span>
            {previewCount > 0
              ? `${previewCount} cookie${previewCount === 1 ? "" : "s"} detectadas`
              : "Aún no se detectan cookies"}
          </span>
          <Button
            variant="primary"
            size="sm"
            isDisabled={disabled}
            onPress={() => saveMutation.mutate(trimmed)}
          >
            {saveMutation.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Save className="h-3.5 w-3.5" />
            )}
            {saveMutation.isPending ? "Guardando…" : "Guardar cookies"}
          </Button>
        </div>
      </div>
    </Card>
  );
}
