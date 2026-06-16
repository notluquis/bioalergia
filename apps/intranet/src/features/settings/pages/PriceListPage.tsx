import {
  Button,
  Card,
  Checkbox,
  Chip,
  Input,
  Label,
  ListBox,
  Select,
  TextField,
} from "@heroui/react";
import type { PriceListItemDto } from "@finanzas/orpc-contracts/price-list";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { Coins, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { DataTable } from "@/components/data-table/DataTable";
import { confirmAction } from "@/components/ui/ConfirmDialog";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { priceListORPCClient, toPriceListApiError } from "@/features/settings/price-list-orpc";
import { PAGE_CONTAINER } from "@/lib/styles";
import { toast } from "@/lib/toast-interceptor";

const KEY = ["settings", "price-list"] as const;

const UNITS = ["unidad", "dosis", "sesion", "mL"] as const;
type Unit = (typeof UNITS)[number];

const UNIT_LABEL: Record<string, string> = {
  unidad: "Unidad",
  dosis: "Dosis",
  sesion: "Sesión",
  mL: "mL",
};

const CLP = new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP" });

const EMPTY_FORM = {
  id: "",
  code: "",
  name: "",
  category: "",
  unit: "unidad" as Unit,
  priceClp: "",
  sortOrder: "0",
  isActive: true,
  notes: "",
};

export function PriceListPage() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: KEY,
    queryFn: async () => {
      try {
        const res = await priceListORPCClient.list();
        return res.items;
      } catch (error) {
        throw toPriceListApiError(error);
      }
    },
  });

  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [editing, setEditing] = useState(false);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: KEY });

  const upsert = useMutation({
    mutationFn: async () => {
      const price = Number(form.priceClp);
      const order = Number(form.sortOrder);
      if (!form.name.trim()) throw new Error("Indica el nombre");
      if (!form.category.trim()) throw new Error("Indica la categoría");
      if (!Number.isFinite(price) || price < 0) throw new Error("Precio inválido");
      if (!Number.isFinite(order) || order < 0) throw new Error("Orden inválido");
      try {
        return await priceListORPCClient.upsert({
          id: form.id || undefined,
          code: form.code.trim() || undefined,
          name: form.name.trim(),
          category: form.category.trim(),
          unit: form.unit,
          priceClp: Math.round(price),
          sortOrder: Math.round(order),
          isActive: form.isActive,
          notes: form.notes.trim() || undefined,
        });
      } catch (error) {
        throw toPriceListApiError(error);
      }
    },
    onSuccess: () => {
      toast.success("Ítem guardado");
      void invalidate();
      setForm({ ...EMPTY_FORM });
      setEditing(false);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "No se pudo guardar"),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      try {
        return await priceListORPCClient.remove({ id });
      } catch (error) {
        throw toPriceListApiError(error);
      }
    },
    onSuccess: () => {
      toast.success("Ítem eliminado");
      void invalidate();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "No se pudo eliminar"),
  });

  const onEdit = (p: PriceListItemDto) => {
    setForm({
      id: p.id,
      code: p.code ?? "",
      name: p.name,
      category: p.category,
      unit: (UNITS.includes(p.unit as Unit) ? p.unit : "unidad") as Unit,
      priceClp: String(p.priceClp),
      sortOrder: String(p.sortOrder),
      isActive: p.isActive,
      notes: p.notes ?? "",
    });
    setEditing(true);
  };

  const onDelete = async (p: PriceListItemDto) => {
    const ok = await confirmAction({
      title: "Eliminar ítem de la lista de precios",
      description: `¿Eliminar "${p.name}" de la lista de precios pública?`,
      confirmLabel: "Eliminar",
      variant: "danger",
    });
    if (ok) remove.mutate(p.id);
  };

  const columns: ColumnDef<PriceListItemDto>[] = [
    {
      header: "Código",
      accessorKey: "code",
      cell: ({ row }) => <span className="font-mono text-xs">{row.original.code ?? "—"}</span>,
    },
    {
      header: "Nombre",
      accessorKey: "name",
      cell: ({ row }) => <span className="font-medium text-sm">{row.original.name}</span>,
    },
    {
      header: "Categoría",
      accessorKey: "category",
      cell: ({ row }) => <span className="text-sm">{row.original.category}</span>,
    },
    {
      header: "Unidad",
      accessorKey: "unit",
      cell: ({ row }) => (
        <span className="text-sm">{UNIT_LABEL[row.original.unit] ?? row.original.unit}</span>
      ),
    },
    {
      header: "Precio",
      accessorKey: "priceClp",
      cell: ({ row }) => (
        <span className="font-medium text-sm">{CLP.format(row.original.priceClp)}</span>
      ),
    },
    {
      header: "Estado",
      accessorKey: "isActive",
      cell: ({ row }) => (
        <Chip size="sm" variant="soft" color={row.original.isActive ? "success" : "default"}>
          {row.original.isActive ? "Activo" : "Inactivo"}
        </Chip>
      ),
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
            <Trash2 size={14} aria-hidden="true" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className={PAGE_CONTAINER}>
      <div className="mb-4 flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Coins size={22} aria-hidden="true" />
        </div>
        <div>
          <h1 className="font-bold text-foreground text-xl tracking-tight">Lista de precios</h1>
          <p className="text-default-500 text-sm">
            Precios públicos de prestaciones e insumos, ordenados por categoría.
          </p>
        </div>
      </div>

      <Card className="mb-6 space-y-4 p-5">
        <h2 className="font-semibold text-base">{editing ? "Editar ítem" : "Nuevo ítem"}</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <TextField value={form.name} onChange={(v) => setForm((f) => ({ ...f, name: v }))}>
            <Label>Nombre</Label>
            <Input placeholder="ej. Consulta inmunología" />
          </TextField>
          <TextField value={form.code} onChange={(v) => setForm((f) => ({ ...f, code: v }))}>
            <Label>Código</Label>
            <Input placeholder="Opcional (único)" />
          </TextField>
          <TextField
            value={form.category}
            onChange={(v) => setForm((f) => ({ ...f, category: v }))}
          >
            <Label>Categoría</Label>
            <Input placeholder="ej. Consultas" />
          </TextField>
          <div className="space-y-1">
            <Label className="font-medium text-sm">Unidad</Label>
            <Select
              aria-label="Unidad"
              selectedKey={form.unit}
              onSelectionChange={(k) => setForm((f) => ({ ...f, unit: String(k) as Unit }))}
            >
              <Select.Trigger>
                <Select.Value />
                <Select.Indicator />
              </Select.Trigger>
              <Select.Popover>
                <ListBox>
                  {UNITS.map((u) => (
                    <ListBox.Item key={u} id={u} textValue={UNIT_LABEL[u]}>
                      {UNIT_LABEL[u]}
                      <ListBox.ItemIndicator />
                    </ListBox.Item>
                  ))}
                </ListBox>
              </Select.Popover>
            </Select>
          </div>
          <TextField
            value={form.priceClp}
            onChange={(v) => setForm((f) => ({ ...f, priceClp: v }))}
          >
            <Label>Precio (CLP)</Label>
            <Input placeholder="25000" inputMode="numeric" />
          </TextField>
          <TextField
            value={form.sortOrder}
            onChange={(v) => setForm((f) => ({ ...f, sortOrder: v }))}
          >
            <Label>Orden</Label>
            <Input placeholder="0" inputMode="numeric" />
          </TextField>
          <TextField value={form.notes} onChange={(v) => setForm((f) => ({ ...f, notes: v }))}>
            <Label>Notas</Label>
            <Input placeholder="Opcional" />
          </TextField>
          <Checkbox
            className="flex items-end pb-2"
            isSelected={form.isActive}
            onChange={(v) => setForm((f) => ({ ...f, isActive: v }))}
          >
            <Checkbox.Content>
              <Checkbox.Control>
                <Checkbox.Indicator />
              </Checkbox.Control>
              Activo
            </Checkbox.Content>
          </Checkbox>
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
            <Plus size={16} aria-hidden="true" />
            {editing ? "Guardar" : "Agregar"}
          </Button>
        </div>
      </Card>

      {isLoading ? (
        <div className="flex justify-center py-10">
          <LoadingSpinner label="Cargando lista de precios" />
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={data ?? []}
          enablePagination={false}
          enableToolbar={false}
          noDataMessage="Sin ítems en la lista de precios. Crea uno arriba."
        />
      )}
    </div>
  );
}
