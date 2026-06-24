import { formatChile } from "@/lib/dates";
import { Button, Card, Chip, Description, Label, ListBox, Select } from "@heroui/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { History, RefreshCw } from "lucide-react";
import { useMemo, useState } from "react";

import { DataTable } from "@/components/data-table/DataTable";
import { useToast } from "@/context/ToastContext";
import { triggerDoctoraliaCalendarSync } from "@/features/doctoralia/api";
import { doctoraliaSettingsKeys } from "@/features/doctoralia/settings-queries";
import type { DoctoraliaSyncLog } from "@/features/doctoralia/types";

const SYNC_TYPES: Array<"ALL" | DoctoraliaSyncLog["syncType"]> = ["ALL", "CALENDAR", "EMAIL"];

const STATUSES = ["ALL", "OK", "ERROR", "RUNNING"] as const;

function formatDate(value: Date | null) {
  if (!value) return "—";
  return formatChile(value, "DD/MM HH:mm:ss");
}

function formatDuration(start: Date, end: Date | null) {
  if (!end) return "—";
  const ms = end.getTime() - start.getTime();
  if (ms < 1000) return `${ms} ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)} s`;
  const mins = Math.floor(ms / 60_000);
  const secs = Math.floor((ms % 60_000) / 1000);
  return `${mins}m ${secs}s`;
}

function statusColor(status: string): "accent" | "danger" | "success" | "default" {
  const s = status.toUpperCase();
  if (s === "OK" || s === "SUCCESS") return "success";
  if (s === "ERROR" || s === "FAILED") return "danger";
  if (s === "RUNNING") return "accent";
  return "default";
}

export function DoctoraliaSyncLogsPanel() {
  const toast = useToast();
  const queryClient = useQueryClient();

  const { data: logs = [], isPending } = useQuery({
    ...doctoraliaSettingsKeys.syncLogs(),
    refetchInterval: 30_000,
  });

  const syncNowMutation = useMutation({
    mutationFn: triggerDoctoraliaCalendarSync,
    onError: (err: Error) => toast.error(`Error al sincronizar: ${err.message}`),
    onSuccess: (result) => {
      if (result.status === "error") {
        toast.error(result.message, "Sincronización fallida");
        return;
      }
      if (result.status === "skip") {
        toast.info(result.message, "Sincronización omitida");
        return;
      }
      toast.success(result.message, "Sincronización completada");
      void queryClient.invalidateQueries({ queryKey: doctoraliaSettingsKeys.all });
    },
  });

  const [syncTypeFilter, setSyncTypeFilter] = useState<(typeof SYNC_TYPES)[number]>("ALL");
  const [statusFilter, setStatusFilter] = useState<(typeof STATUSES)[number]>("ALL");

  const filtered = useMemo(() => {
    return logs.filter((log) => {
      if (syncTypeFilter !== "ALL" && log.syncType !== syncTypeFilter) return false;
      if (statusFilter !== "ALL" && log.status.toUpperCase() !== statusFilter) return false;
      return true;
    });
  }, [logs, syncTypeFilter, statusFilter]);

  const columns = useMemo<ColumnDef<DoctoraliaSyncLog>[]>(
    () => [
      {
        accessorKey: "startedAt",
        header: "Inicio",
        cell: ({ row }) => (
          <>
            <div className="font-medium text-default-900 text-sm">
              {formatDate(row.original.startedAt)}
            </div>
            {row.original.endedAt ? (
              <div className="text-default-400 text-xs">Fin {formatDate(row.original.endedAt)}</div>
            ) : null}
          </>
        ),
      },
      {
        accessorKey: "syncType",
        header: "Tipo",
        cell: ({ row }) => (
          <Chip size="sm" variant="soft">
            {row.original.syncType === "CALENDAR" ? "Calendario" : "Correo"}
          </Chip>
        ),
      },
      {
        accessorKey: "status",
        header: "Estado",
        cell: ({ row }) => (
          <>
            <Chip color={statusColor(row.original.status)} size="sm" variant="soft">
              {row.original.status}
            </Chip>
            {row.original.errorMessage ? (
              <div className="mt-1 text-danger-500 text-xs">{row.original.errorMessage}</div>
            ) : null}
          </>
        ),
      },
      {
        id: "source",
        header: "Origen",
        cell: ({ row }) => (
          <span className="text-default-500 text-xs">
            {row.original.triggerSource ?? "—"}
            {row.original.triggerUserId ? ` · user#${row.original.triggerUserId}` : ""}
          </span>
        ),
      },
      {
        id: "duration",
        header: "Duración",
        cell: ({ row }) => (
          <span className="text-default-500 text-xs">
            {formatDuration(row.original.startedAt, row.original.endedAt)}
          </span>
        ),
      },
      {
        id: "summary",
        header: "Resumen",
        cell: ({ row }) => (
          <div className="flex flex-wrap gap-1">
            {Object.entries(row.original.counts).map(([key, value]) => (
              <Chip key={key} size="sm" variant="soft">
                {key}: {value}
              </Chip>
            ))}
          </div>
        ),
      },
    ],
    []
  );

  return (
    <div className="mt-4 space-y-4">
      <Card>
        <Card.Header className="flex items-center justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 font-semibold text-base">
              <History className="size-4" /> Registro de sincronizaciones
            </h2>
            <Description className="text-default-500 text-xs">
              Últimos 50 eventos de sincronización (scraper, listener IMAP y backfills manuales). Se
              refresca cada 30 s.
            </Description>
          </div>
          <Button
            isDisabled={syncNowMutation.isPending}
            isPending={syncNowMutation.isPending}
            onPress={() => syncNowMutation.mutate()}
            size="sm"
            variant="secondary"
          >
            <RefreshCw className="size-4" />
            Sincronizar ahora
          </Button>
        </Card.Header>
        <Card.Content className="space-y-3">
          <div className="flex flex-wrap items-end gap-3">
            <Select
              className="w-40"
              onChange={(key) => {
                if (key) setSyncTypeFilter(key as typeof syncTypeFilter);
              }}
              value={syncTypeFilter}
            >
              <Label className="text-default-500 text-xs">Tipo</Label>
              <Select.Trigger>
                <Select.Value />
                <Select.Indicator />
              </Select.Trigger>
              <Select.Popover>
                <ListBox>
                  <ListBox.Item id="ALL">Todos los tipos</ListBox.Item>
                  <ListBox.Item id="CALENDAR">Calendario</ListBox.Item>
                  <ListBox.Item id="EMAIL">Correo</ListBox.Item>
                </ListBox>
              </Select.Popover>
            </Select>

            <Select
              className="w-40"
              onChange={(key) => {
                if (key) setStatusFilter(key as typeof statusFilter);
              }}
              value={statusFilter}
            >
              <Label className="text-default-500 text-xs">Estado</Label>
              <Select.Trigger>
                <Select.Value />
                <Select.Indicator />
              </Select.Trigger>
              <Select.Popover>
                <ListBox>
                  <ListBox.Item id="ALL">Todos los estados</ListBox.Item>
                  <ListBox.Item id="OK">OK</ListBox.Item>
                  <ListBox.Item id="ERROR">Error</ListBox.Item>
                  <ListBox.Item id="RUNNING">En curso</ListBox.Item>
                </ListBox>
              </Select.Popover>
            </Select>

            <Chip size="sm" variant="soft">
              {filtered.length} evento{filtered.length === 1 ? "" : "s"}
            </Chip>
          </div>

          <DataTable
            enableToolbar={false}
            columns={columns}
            containerVariant="plain"
            data={filtered}
            enableExport={false}
            enableGlobalFilter={false}
            enableVirtualization={false}
            isLoading={isPending}
            noDataMessage="Sin registros para los filtros seleccionados."
          />
        </Card.Content>
      </Card>
    </div>
  );
}
