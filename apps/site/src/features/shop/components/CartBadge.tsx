import { Badge, Button } from "@heroui/react";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "@tanstack/react-router";
import { ShoppingCart } from "lucide-react";

import { shopKeys } from "@/features/shop/queries";

const SHOP_PREFIXES = ["/tienda", "/producto", "/carrito", "/checkout"];

export function CartBadge() {
  const { pathname } = useLocation();
  const visible = SHOP_PREFIXES.some((p) => pathname.startsWith(p));

  const { data } = useQuery({
    ...shopKeys.cart(),
    enabled: visible,
  });

  if (!visible) return null;

  const count = data?.data?.items?.reduce((acc, i) => acc + i.qty, 0) ?? 0;

  return (
    <div className="fixed top-4 right-4 z-50 sm:top-6 sm:right-6">
      <Link to="/carrito">
        <Badge color="accent" content={count > 0 ? String(count) : undefined} placement="top-right">
          <Button
            aria-label={`Carrito (${count} ítems)`}
            className="h-12 w-12 rounded-full shadow-lg"
            isIconOnly
            variant="primary"
          >
            <ShoppingCart size={20} />
          </Button>
        </Badge>
      </Link>
    </div>
  );
}
