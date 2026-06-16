import type { SecurityAlertStateDto } from "@finanzas/orpc-contracts/security-alerts";
import { useQuery } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { LayoutDashboard } from "lucide-react";
import { DataTable } from "@/components/data-table/DataTable";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import {
  securityAlertsORPCClient,
  toSecurityAlertsApiError,
} from "@/features/settings/security-alerts-orpc";
import { formatChile, fromNow } from "@/lib/dates";
import { PAGE_CONTAINER } from "@/lib/styles";

const KEY = ["settings", "security-alerts"] as const;

// Familias de alerta conocidas (escritas por lib/security-alerts.ts vía
// account-lockout, audit-anomaly y audit-chain-verify). Para `anomaly:<kind>`
// la etiqueta se compone con un sufijo legible; cualquier tipo no listado cae
// al valor crudo.
const ALERT_TYPE_LABEL: Record<string, string> = {
  audit_chain_tampered: "Cadena de auditoría alterada",
  login_lockout_short: "Bloqueo de cuenta (corto)",
  login_lockout_long: "Bloqueo de cuenta (largo)",
  "anomaly:mass_read": "Anomalía: lectura masiva",
  "anomaly:off_hours": "Anomalía: fuera de horario",
  "anomaly:bulk_export": "Anomalía: exportación masiva",
  "anomaly:failed_auth": "Anomalía: autenticaciones fallidas",
  "anomaly:lockout_spike": "Anomalía: pico de bloqueos",
};

function labelAlertType(alertType: string): string {
  return ALERT_TYPE_LABEL[alertType] ?? alertType;
}

export function SecurityAlertsPage() {
  const { data, isLoading } = useQuery({
    queryKey: KEY,
    queryFn: async () => {
      try {
        const res = await securityAlertsORPCClient.list();
        return res.states;
      } catch (error) {
        throw toSecurityAlertsApiError(error);
      }
    },
  });

  const columns: ColumnDef<SecurityAlertStateDto>[] = [
    {
      header: "Ámbito",
      accessorKey: "scope",
      cell: ({ row }) => <span className="font-mono text-sm">{row.original.scope}</span>,
    },
    {
      header: "Tipo de alerta",
      accessorKey: "alertType",
      cell: ({ row }) => (
        <div className="flex flex-col gap-0.5">
          <span className="text-sm">{labelAlertType(row.original.alertType)}</span>
          <span className="font-mono text-default-400 text-xs">{row.original.alertType}</span>
        </div>
      ),
    },
    {
      header: "Última vez enviada",
      accessorKey: "lastSentAt",
      cell: ({ row }) => (
        <div className="flex flex-col gap-0.5">
          <span className="text-sm">{fromNow(row.original.lastSentAt)}</span>
          <span className="text-default-400 text-xs">
            {formatChile(row.original.lastSentAt, "DD/MM/YYYY HH:mm")}
          </span>
        </div>
      ),
    },
  ];

  return (
    <div className={PAGE_CONTAINER}>
      <div className="mb-4 flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <LayoutDashboard size={22} aria-hidden="true" />
        </div>
        <div>
          <h1 className="font-bold text-foreground text-xl tracking-tight">Alertas de seguridad</h1>
          <p className="text-default-500 text-sm">
            Estado de las alertas de seguridad ya emitidas (con deduplicación por ámbito y tipo).
            Panel de sólo lectura.
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-10">
          <LoadingSpinner label="Cargando alertas de seguridad" />
        </div>
      ) : (data?.length ?? 0) === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-default-200 border-dashed py-12 text-center">
          <LayoutDashboard size={28} className="text-default-300" aria-hidden="true" />
          <p className="font-medium text-default-600 text-sm">Sin alertas registradas</p>
          <p className="max-w-md text-default-400 text-xs">
            Aún no se ha emitido ninguna alerta de seguridad. Cuando el sistema detecte un evento
            relevante (bloqueos de cuenta, anomalías de auditoría, etc.) aparecerá aquí.
          </p>
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={data ?? []}
          enablePagination={false}
          enableToolbar={false}
          noDataMessage="Sin alertas registradas"
        />
      )}
    </div>
  );
}
