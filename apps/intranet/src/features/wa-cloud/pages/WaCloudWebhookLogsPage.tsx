import { formatChile } from "@/lib/dates";
import { Card, Chip } from "@heroui/react";
import { useQuery } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/data-table/DataTable";
import { waCloudORPCClient } from "../orpc";

export function WaCloudWebhookLogsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["wa-cloud", "webhook-logs"],
    queryFn: () => waCloudORPCClient.listWebhookLogs({ limit: 100 }),
    refetchInterval: 3000,
  });

  const logs = data?.logs ?? [];
  type LogRow = (typeof logs)[number];

  const columns: ColumnDef<LogRow>[] = [
    {
      id: "receivedAt",
      header: "Recibido",
      cell: ({ row }) => formatChile(row.original.receivedAt, "HH:mm:ss"),
    },
    {
      id: "signatureValid",
      header: "Firma HMAC",
      cell: ({ row }) => (
        <Chip size="sm" color={row.original.signatureValid ? "success" : "danger"} variant="soft">
          {row.original.signatureValid ? "OK" : "INVALID"}
        </Chip>
      ),
    },
    {
      id: "processed",
      header: "Procesado",
      cell: ({ row }) => (
        <Chip size="sm" color={row.original.processed ? "success" : "warning"} variant="soft">
          {row.original.processed ? "✓" : "no"}
        </Chip>
      ),
    },
    {
      id: "eventCount",
      header: "Eventos",
      cell: ({ row }) => <span className="font-mono text-xs">{row.original.eventCount}</span>,
    },
    {
      id: "fields",
      header: "Fields",
      cell: ({ row }) => (
        <div className="flex flex-wrap gap-1">
          {row.original.fields.length === 0 ? (
            <span className="text-default-400 text-xs">—</span>
          ) : (
            row.original.fields.map((f) => (
              <Chip key={f} size="sm" variant="soft">
                {f}
              </Chip>
            ))
          )}
        </div>
      ),
    },
    {
      id: "error",
      header: "Error",
      cell: ({ row }) =>
        row.original.errorMessage ? (
          <span className="text-danger text-xs">{row.original.errorMessage.slice(0, 100)}</span>
        ) : (
          <span className="text-default-400 text-xs">—</span>
        ),
    },
    {
      id: "preview",
      header: "Preview",
      cell: ({ row }) => (
        <pre className="max-w-xl overflow-x-auto rounded bg-default-100 p-1 text-xs">
          {row.original.preview}
        </pre>
      ),
    },
  ];

  return (
    <div className="space-y-4 p-6">
      <Card>
        <Card.Header>
          <Card.Title>Webhook logs (refresh 3s)</Card.Title>
          <Card.Description>
            Cada POST de Meta queda registrado. Click "Test" en Meta dashboard y aparece aquí.
          </Card.Description>
        </Card.Header>
        <Card.Content className="p-0">
          <DataTable
            enableToolbar={false}
            columns={columns}
            data={logs}
            isLoading={isLoading}
            noDataMessage="Sin registros de webhook."
          />
        </Card.Content>
      </Card>
    </div>
  );
}
