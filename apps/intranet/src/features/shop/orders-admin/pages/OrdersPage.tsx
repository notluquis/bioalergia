import { Button, Label, ListBox, SearchField, Select } from "@heroui/react";
import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ShoppingBag } from "lucide-react";
import { useEffect, useState } from "react";
import { DataTable } from "@/components/data-table/DataTable";
import { Page } from "@/components/layouts/Page";
import { PageHeader } from "@/components/layouts/PageHeader";
import { PageState } from "@/components/ui/PageState";
import { confirmAction } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/context/ToastContext";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { cancelOrder, markOrderFulfilled, refundOrder } from "../api";
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

  const ordersQuery = useInfiniteQuery(
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

  const cancelMutation = useMutation({
    mutationFn: (id: number) => cancelOrder(id),
    onError: (e) => {
      toastError(e instanceof Error ? e.message : "No se pudo cancelar el pedido");
    },
    onSuccess: (order) => {
      success(`Pedido ${order.number} cancelado`);
      void queryClient.invalidateQueries({ queryKey: orderKeys.all });
    },
  });

  const refundMutation = useMutation({
    mutationFn: (id: number) => refundOrder(id),
    onError: (e) => {
      toastError(e instanceof Error ? e.message : "No se pudo reembolsar el pedido");
    },
    onSuccess: (order) => {
      success(`Pedido ${order.number} reembolsado`);
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

  function handleCancel(id: number) {
    if (!canUpdate) {
      return;
    }
    void (async () => {
      const ok = await confirmAction({
        title: "Cancelar pedido",
        description: "El pedido se cancelará y el stock se liberará.",
        confirmLabel: "Cancelar pedido",
        cancelLabel: "Volver",
      });
      if (ok) {
        cancelMutation.mutate(id);
      }
    })();
  }

  function handleRefund(id: number) {
    if (!canUpdate) {
      return;
    }
    void (async () => {
      const ok = await confirmAction({
        title: "Reembolsar pedido",
        description:
          "Se reembolsará el pago al cliente vía MercadoPago y el stock volverá. Esta acción no se puede deshacer. La nota de crédito (DTE) debe emitirse manualmente.",
        confirmLabel: "Reembolsar",
        cancelLabel: "Volver",
        variant: "danger",
        requireText: "REEMBOLSAR",
      });
      if (ok) {
        refundMutation.mutate(id);
      }
    })();
  }

  const meta: OrdersTableMeta = {
    canUpdate,
    fulfillingId: fulfillMutation.isPending ? (fulfillMutation.variables ?? null) : null,
    cancellingId: cancelMutation.isPending ? (cancelMutation.variables ?? null) : null,
    refundingId: refundMutation.isPending ? (refundMutation.variables ?? null) : null,
    onCancel: handleCancel,
    onFulfill: handleFulfill,
    onRefund: handleRefund,
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
        isEmpty={(result) => result.pages.every((p) => p.orders.length === 0)}
        loadingLabel="Cargando pedidos"
      >
        {(result) => {
          const orders = result.pages.flatMap((p) => p.orders);
          return (
            <div className="surface-elevated flex flex-col gap-3 rounded-2xl p-4">
              {/* No client pagination: the cursor "Cargar más" below IS the
                  pagination. Client paging auto-resets to page 1 on each append,
                  hiding the just-loaded rows. The list scrolls instead. */}
              <DataTable
                columns={columns}
                containerVariant="plain"
                data={orders}
                enableExport={false}
                enableGlobalFilter={false}
                enablePagination={false}
                meta={meta}
                noDataMessage="No hay pedidos registrados."
                scrollMaxHeight="min(68dvh, 760px)"
              />
              {ordersQuery.hasNextPage ? (
                <Button
                  className="self-center"
                  isPending={ordersQuery.isFetchingNextPage}
                  onPress={() => {
                    void ordersQuery.fetchNextPage();
                  }}
                  variant="secondary"
                >
                  Cargar más pedidos
                </Button>
              ) : null}
            </div>
          );
        }}
      </PageState>

      <OrderDetailModal onClose={() => setDetailId(null)} orderId={detailId} />
    </Page>
  );
}
