import { Label, ListBox, SearchField, Select } from "@heroui/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ShoppingBag } from "lucide-react";
import { useEffect, useState } from "react";
import { DataTable } from "@/components/data-table/DataTable";
import { Page } from "@/components/layouts/Page";
import { PageHeader } from "@/components/layouts/PageHeader";
import { PageState } from "@/components/ui/PageState";
import { confirmAction } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/context/ToastContext";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { markOrderFulfilled } from "../api";
import { columns } from "../components/columns";
import type { OrdersTableMeta } from "../components/columns";
import { OrderDetailModal } from "../components/OrderDetailModal";
import { orderKeys } from "../queries";
import type { OrderStatus } from "../types";

const STATUS_OPTIONS: { id: OrderStatus | "ALL"; label: string }[] = [
  { id: "ALL", label: "Todos los estados" },
  { id: "PENDING", label: "Pendiente" },
  { id: "PAID", label: "Pagado" },
  { id: "FULFILLED", label: "Despachado" },
  { id: "CANCELLED", label: "Cancelado" },
  { id: "REFUNDED", label: "Reembolsado" },
];

export function OrdersPage() {
  const { can } = useAuth();
  const canUpdate = can("update", "ShopOrder");
  const queryClient = useQueryClient();
  const { error: toastError, success } = useToast();

  const [statusFilter, setStatusFilter] = useState<OrderStatus | "ALL">("ALL");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [detailId, setDetailId] = useState<number | null>(null);

  // Debounce the search box → query key.
  useEffect(() => {
    const handle = setTimeout(() => {
      setSearch(searchInput.trim());
    }, 300);
    return () => {
      clearTimeout(handle);
    };
  }, [searchInput]);

  const ordersQuery = useQuery(
    orderKeys.list({
      status: statusFilter === "ALL" ? undefined : statusFilter,
      search: search || undefined,
    })
  );

  const fulfillMutation = useMutation({
    mutationFn: (id: number) => markOrderFulfilled(id),
    onError: (e) => {
      toastError(e instanceof Error ? e.message : "No se pudo marcar el pedido como despachado");
    },
    onSuccess: (order) => {
      success(`Pedido ${order.number} marcado como despachado`);
      void queryClient.invalidateQueries({ queryKey: orderKeys.all });
    },
  });

  function handleFulfill(id: number) {
    if (!canUpdate) {
      return;
    }
    void (async () => {
      const ok = await confirmAction({
        title: "Marcar pedido como despachado",
        description:
          "Confirma que el pedido fue preparado y entregado al courier. El estado cambiará a Despachado.",
        confirmLabel: "Marcar despachado",
      });
      if (ok) {
        fulfillMutation.mutate(id);
      }
    })();
  }

  const meta: OrdersTableMeta = {
    canUpdate,
    fulfillingId: fulfillMutation.isPending ? (fulfillMutation.variables ?? null) : null,
    onFulfill: handleFulfill,
    onView: setDetailId,
  };

  return (
    <Page>
      <PageHeader
        description="Pedidos de la tienda online: estado de pago, documento tributario y despacho."
        icon={<ShoppingBag size={22} />}
        title="Pedidos"
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <Select
          className="w-full sm:w-56"
          onChange={(key) => {
            if (key) {
              setStatusFilter(key as OrderStatus | "ALL");
            }
          }}
          value={statusFilter}
        >
          <Label>Estado</Label>
          <Select.Trigger>
            <Select.Value />
            <Select.Indicator />
          </Select.Trigger>
          <Select.Popover>
            <ListBox>
              {STATUS_OPTIONS.map((opt) => (
                <ListBox.Item id={opt.id} key={opt.id}>
                  {opt.label}
                </ListBox.Item>
              ))}
            </ListBox>
          </Select.Popover>
        </Select>

        <SearchField
          aria-label="Buscar pedidos"
          className="w-full sm:max-w-xs"
          onChange={setSearchInput}
          value={searchInput}
        >
          <Label>Buscar</Label>
          <SearchField.Group>
            <SearchField.SearchIcon />
            <SearchField.Input placeholder="Número, cliente o correo…" />
            <SearchField.ClearButton />
          </SearchField.Group>
        </SearchField>
      </div>

      <PageState
        query={ordersQuery}
        emptyDescription="No hay pedidos que coincidan con los filtros."
        emptyTitle="Sin pedidos"
        isEmpty={(result) => result.orders.length === 0}
        loadingLabel="Cargando pedidos"
      >
        {(result) => (
          <div className="surface-elevated rounded-2xl p-4">
            <DataTable
              columns={columns}
              containerVariant="plain"
              data={result.orders}
              enableExport={false}
              enableGlobalFilter={false}
              enablePagination
              meta={meta}
              noDataMessage="No hay pedidos registrados."
              pageSizeOptions={[10, 20, 50]}
              scrollMaxHeight="min(68dvh, 760px)"
            />
          </div>
        )}
      </PageState>

      <OrderDetailModal onClose={() => setDetailId(null)} orderId={detailId} />
    </Page>
  );
}
