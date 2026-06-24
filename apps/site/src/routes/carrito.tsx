import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

import { CartView } from "@/features/shop/components/CartView";
import { shopKeys } from "@/features/shop/queries";
import { cartClient } from "@/lib/orpc-client";

function CarritoPage() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery(shopKeys.cart());

  const updateMutation = useMutation({
    mutationFn: (input: { product_id: number; qty: number }) => cartClient.updateItem(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: shopKeys.cart().queryKey }),
  });
  const removeMutation = useMutation({
    mutationFn: (product_id: number) => cartClient.removeItem({ product_id }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: shopKeys.cart().queryKey }),
  });

  return (
    <CartView
      cart={data?.data}
      isLoading={isLoading}
      onRemove={(productId) => removeMutation.mutate(productId)}
      onUpdateQty={(input) => updateMutation.mutate(input)}
    />
  );
}

export const Route = createFileRoute("/carrito")({
  component: CarritoPage,
});
