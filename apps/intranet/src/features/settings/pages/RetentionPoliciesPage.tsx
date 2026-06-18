import { Button, Card, Chip, Input, Label, ListBox, Select, TextField } from "@heroui/react";
import type { RetentionPolicyDto } from "@finanzas/orpc-contracts/settings";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { Plus, ShieldCheck, Trash2 } from "lucide-react";
import { useState } from "react";
import { DataTable } from "@/components/data-table/DataTable";
import { Page } from "@/components/layouts/Page";
import { PageHeader } from "@/components/layouts/PageHeader";
import { confirmAction } from "@/components/ui/ConfirmDialog";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { settingsORPCClient, toSettingsApiError } from "@/features/settings/orpc";
import { toast } from "@/lib/toast-interceptor";

const KEY = ["settings", "retention-policies"] as const;

type Action = "delete" | "anonymize";

const ACTION_LABEL: Record<string, string> = {
  delete: "Borrar",
  anonymize: "Anonimizar",
};

const EMPTY_FORM = {
  table: "",
  action: "delete" as Action,
  windowDays: "",
  dateColumn: "created_at",
  enabled: true,
  notes: "",
};

export function RetentionPoliciesPage() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: KEY,
    queryFn: async () => {
      try {
        const res = await settingsORPCClient.listRetentionPolicies();
        return res.policies;
      } catch (error) {
        throw toSettingsApiError(error);
      }
    },
  });

  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [editing, setEditing] = useState(false);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: KEY });

  const upsert = useMutation({
    mutationFn: async () => {
      const days = Number(form.windowDays);
      if (!form.table.trim()) throw new Error("Indica la tabla");
      if (!Number.isFinite(days) || days < 1) throw new Error("Ventana (días) inválida");
      try {
        return await settingsORPCClient.upsertRetentionPolicy({
          table: form.table.trim(),
          action: form.action,
          windowDays: days,
          dateColumn: form.dateColumn.trim() || "created_at",
          enabled: form.enabled,
          notes: form.notes.trim() || undefined,
        });
      } catch (error) {
        throw toSettingsApiError(error);
      }
    },
    onSuccess: () => {
      toast.success("Política guardada");
      void invalidate();
      setForm({ ...EMPTY_FORM });
      setEditing(false);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "No se pudo guardar"),
  });

  const remove = useMutation({
    mutationFn: async (table: string) => {
      try {
        return await settingsORPCClient.deleteRetentionPolicy({ table });
      } catch (error) {
        throw toSettingsApiError(error);
      }
    },
    onSuccess: () => {
      toast.success("Política eliminada");
      void invalidate();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "No se pudo eliminar"),
  });

  const onEdit = (p: RetentionPolicyDto) => {
    setForm({
      table: p.table,
      action: p.action,
      windowDays: String(p.windowDays),
      dateColumn: p.dateColumn,
      enabled: p.enabled,
      notes: p.notes ?? "",
    });
    setEditing(true);
  };

  const onDelete = async (p: RetentionPolicyDto) => {
    const ok = await confirmAction({
      title: "Eliminar política de retención",
      description: `¿Eliminar la política de retención de "${p.table}"? El sweep dejará de aplicarla.`,
      confirmLabel: "Eliminar",
      variant: "danger",
    });
    if (ok) remove.mutate(p.table);
  };

  const columns: ColumnDef<RetentionPolicyDto>[] = [
    {
      header: "Tabla",
      accessorKey: "table",
      cell: ({ row }) => <span className="font-mono text-sm">{row.original.table}</span>,
    },
    {
      header: "Estado",
      accessorKey: "enabled",
      cell: ({ row }) => (
        <Chip size="sm" variant="soft" color={row.original.enabled ? "success" : "default"}>
          {row.original.enabled ? "Activa" : "Inactiva"}
        </Chip>
      ),
    },
    {
      header: "Acción",
      accessorKey: "action",
      cell: ({ row }) => (
        <Chip
          size="sm"
          variant="soft"
          color={row.original.action === "delete" ? "danger" : "warning"}
        >
          {ACTION_LABEL[row.original.action] ?? row.original.action}
        </Chip>
      ),
    },
    {
      header: "Ventana",
      accessorKey: "windowDays",
      cell: ({ row }) => <span className="text-sm">{row.original.windowDays} días</span>,
    },
    {
      header: "Columna fecha",
      accessorKey: "dateColumn",
      cell: ({ row }) => <span className="font-mono text-xs">{row.original.dateColumn}</span>,
    },
    {
      header: "",
      id: "actions",
      cell: ({ row }) => (
        <div className="flex justify-end gap-1">
          <Button size="sm" variant="ghost" onPress={() => onEdit(row.original)}>
            Editar
          </Button>
          <Button size="sm" variant="danger" onPress={() => void onDelete(row.original)}>
            <Trash2 size={14} />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <Page>
      <PageHeader
        title="Retención de datos"
        description="Políticas por tabla (Ley 21.719): borrar o anonimizar filas más viejas que la ventana."
        icon={<ShieldCheck size={22} />}
      />

      <Card className="mb-6 space-y-4 p-5">
        <h2 className="font-semibold text-base">
          {editing ? "Editar política" : "Nueva política"}
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <TextField value={form.table} onChange={(v) => setForm((f) => ({ ...f, table: v }))}>
            <Label>Tabla (física)</Label>
            <Input placeholder="ej. audit_logs" disabled={editing} />
          </TextField>
          <div className="space-y-1">
            <Label className="font-medium text-sm">Acción</Label>
            <Select
              aria-label="Acción"
              selectedKey={form.action}
              onSelectionChange={(k) => setForm((f) => ({ ...f, action: String(k) as Action }))}
            >
              <Select.Trigger>
                <Select.Value />
                <Select.Indicator />
              </Select.Trigger>
              <Select.Popover>
                <ListBox>
                  <ListBox.Item id="delete" textValue="Borrar">
                    Borrar
                    <ListBox.ItemIndicator />
                  </ListBox.Item>
                  <ListBox.Item id="anonymize" textValue="Anonimizar">
                    Anonimizar
                    <ListBox.ItemIndicator />
                  </ListBox.Item>
                </ListBox>
              </Select.Popover>
            </Select>
          </div>
          <TextField
            value={form.windowDays}
            onChange={(v) => setForm((f) => ({ ...f, windowDays: v }))}
          >
            <Label>Ventana (días)</Label>
            <Input placeholder="5475" inputMode="numeric" />
          </TextField>
          <TextField
            value={form.dateColumn}
            onChange={(v) => setForm((f) => ({ ...f, dateColumn: v }))}
          >
            <Label>Columna de fecha</Label>
            <Input placeholder="created_at" />
          </TextField>
          <TextField value={form.notes} onChange={(v) => setForm((f) => ({ ...f, notes: v }))}>
            <Label>Notas</Label>
            <Input placeholder="Opcional" />
          </TextField>
          <label className="flex items-end gap-2 pb-2 text-sm">
            <input
              type="checkbox"
              checked={form.enabled}
              onChange={(e) => setForm((f) => ({ ...f, enabled: e.target.checked }))}
            />
            Activa
          </label>
        </div>
        <div className="flex justify-end gap-2">
          {editing && (
            <Button
              variant="outline"
              onPress={() => {
                setForm({ ...EMPTY_FORM });
                setEditing(false);
              }}
            >
              Cancelar
            </Button>
          )}
          <Button className="gap-2" isPending={upsert.isPending} onPress={() => upsert.mutate()}>
            <Plus size={16} />
            {editing ? "Guardar" : "Agregar"}
          </Button>
        </div>
      </Card>

      {isLoading ? (
        <div className="flex justify-center py-10">
          <LoadingSpinner label="Cargando políticas" />
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={data ?? []}
          enablePagination={false}
          enableToolbar={false}
          noDataMessage="Sin políticas de retención. Crea una arriba."
        />
      )}
    </Page>
  );
}
