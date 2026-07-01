import type { ShippingAddressPayload } from "@finanzas/orpc-contracts/orders-admin";
import { compactORPCInput } from "@/lib/orpc-input";
import { ordersAdminORPCClient, toOrdersAdminApiError } from "./orpc";
import { orderDetailResponseSchema, ordersListResponseSchema } from "./schemas";
import type { OrderDetail, OrdersListFilters, OrdersListResult } from "./types";

export async function fetchOrders(filters: OrdersListFilters = {}): Promise<OrdersListResult> {
  try {
    const res = ordersListResponseSchema.parse(
      await ordersAdminORPCClient.list(
        compactORPCInput({
          limit: filters.limit ?? 100,
          cursor: filters.cursor,
          status: filters.status,
          search: filters.search?.trim() || undefined,
        }) ?? {}
      )
    );
    return res.data;
  } catch (error) {
    throw toOrdersAdminApiError(error);
  }
}

export async function fetchOrderDetail(id: number): Promise<OrderDetail> {
  try {
    const res = orderDetailResponseSchema.parse(await ordersAdminORPCClient.detail({ id }));
    return res.data;
  } catch (error) {
    throw toOrdersAdminApiError(error);
  }
}

export async function markOrderFulfilled(id: number): Promise<OrderDetail> {
  try {
    const res = orderDetailResponseSchema.parse(await ordersAdminORPCClient.markFulfilled({ id }));
    return res.data;
  } catch (error) {
    throw toOrdersAdminApiError(error);
  }
}

export async function cancelOrder(id: number): Promise<OrderDetail> {
  try {
    const res = orderDetailResponseSchema.parse(await ordersAdminORPCClient.cancel({ id }));
    return res.data;
  } catch (error) {
    throw toOrdersAdminApiError(error);
  }
}

export async function refundOrder(id: number): Promise<OrderDetail> {
  try {
    const res = orderDetailResponseSchema.parse(await ordersAdminORPCClient.refund({ id }));
    return res.data;
  } catch (error) {
    throw toOrdersAdminApiError(error);
  }
}

export async function updateOrderShippingAddress(
  id: number,
  address: ShippingAddressPayload
): Promise<OrderDetail> {
  try {
    const res = orderDetailResponseSchema.parse(
      await ordersAdminORPCClient.updateShippingAddress({ id, address })
    );
    return res.data;
  } catch (error) {
    throw toOrdersAdminApiError(error);
  }
}
