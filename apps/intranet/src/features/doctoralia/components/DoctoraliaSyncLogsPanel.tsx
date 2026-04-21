import {
  Alert,
  Card,
  Chip,
  Description,
  Label,
  ListBox,
  Select,
  Skeleton,
  Table,
} from "@heroui/react";
import { useQuery } from "@tanstack/react-query";
import dayjs from "dayjs";
import { History } from "lucide-react";
import { useMemo, useState } from "react";

import { doctoraliaSettingsKeys } from "@/features/doctoralia/settings-queries";
import type { DoctoraliaSyncLog } from "@/features/doctoralia/types";

const SYNC_TYPES: Array<"ALL" | DoctoraliaSyncLog["syncType"]> = ["ALL", "CALENDAR", "EMAIL"];

const STATUSES = ["ALL", "OK", "ERROR", "RUNNING"] as const;

function formatDate(value: Date | null) {
  if (!value) return "—";
  return dayjs(value).format("DD/MM HH:mm:ss");
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
  const { data: logs = [], isPending } = useQuery({
    ...doctoraliaSettingsKeys.syncLogs(),
    refetchInterval: 30_000,
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

  return (
    <div className="mt-4 space-y-4">
      <Card>
        <Card.Header className="flex flex-col items-start gap-1">
          <h2 className="flex items-center gap-2 font-semibold text-base">
            <History className="h-4 w-4" /> Registro de sincronizaciones
          </h2>
          <Description className="text-default-500 text-xs">
            Últimos 50 eventos de sincronización (scraper, listener IMAP y backfills manuales). Se
            refresca cada 30 s.
          </Description>
        </Card.Header>
        <Card.Content className="space-y-3">
          <div className="flex flex-wrap gap-3">
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

          {isPending ? (
            <Skeleton className="h-64 w-full rounded-2xl" />
          ) : filtered.length === 0 ? (
            <Alert status="default">
              <Alert.Content>
                <Alert.Description>Sin registros para los filtros seleccionados.</Alert.Description>
              </Alert.Content>
            </Alert>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-default-100">
              <Table variant="secondary">
                <Table.Content aria-label="Logs de sincronización de Doctoralia">
                  <Table.Header>
                    <Table.Column isRowHeader>Inicio</Table.Column>
                    <Table.Column>Tipo</Table.Column>
                    <Table.Column>Estado</Table.Column>
                    <Table.Column className="hidden md:table-cell">Origen</Table.Column>
                    <Table.Column className="hidden md:table-cell">Duración</Table.Column>
                    <Table.Column>Resumen</Table.Column>
                  </Table.Header>
                  <Table.Body>
                    {filtered.map((log) => (
                      <Table.Row id={String(log.id)} key={log.id}>
                        <Table.Cell>
                          <div className="font-medium text-default-900 text-sm">
                            {formatDate(log.startedAt)}
                          </div>
                          {log.endedAt ? (
                            <div className="text-default-400 text-xs">
                              Fin {formatDate(log.endedAt)}
                            </div>
                          ) : null}
                        </Table.Cell>
                        <Table.Cell>
                          <Chip size="sm" variant="soft">
                            {log.syncType === "CALENDAR" ? "Calendario" : "Correo"}
                          </Chip>
                        </Table.Cell>
                        <Table.Cell>
                          <Chip color={statusColor(log.status)} size="sm" variant="soft">
                            {log.status}
                          </Chip>
                          {log.errorMessage ? (
                            <div className="mt-1 text-danger-500 text-xs">{log.errorMessage}</div>
                          ) : null}
                        </Table.Cell>
                        <Table.Cell className="hidden md:table-cell text-default-500 text-xs">
                          {log.triggerSource ?? "—"}
                          {log.triggerUserId ? ` · user#${log.triggerUserId}` : ""}
                        </Table.Cell>
                        <Table.Cell className="hidden md:table-cell text-default-500 text-xs">
                          {formatDuration(log.startedAt, log.endedAt)}
                        </Table.Cell>
                        <Table.Cell>
                          <div className="flex flex-wrap gap-1">
                            {Object.entries(log.counts).map(([key, value]) => (
                              <Chip key={key} size="sm" variant="soft">
                                {key}: {value}
                              </Chip>
                            ))}
                          </div>
                        </Table.Cell>
                      </Table.Row>
                    ))}
                  </Table.Body>
                </Table.Content>
              </Table>
            </div>
          )}
        </Card.Content>
      </Card>
    </div>
  );
}
