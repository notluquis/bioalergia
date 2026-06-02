import { Button, Card, Chip } from "@heroui/react";
import { Link } from "@tanstack/react-router";

import { CLP_FORMATTER, useStockState } from "@/features/shop/lib/shop-config";

type Product = {
  id: number;
  slug: string;
  sku: string;
  name: string;
  brand: string | null;
  price_clp: number;
  compare_at_price_clp: number | null;
  available_qty: number;
  safety_stock: number;
  requires_prescription: boolean;
  images?: Array<{
    cdn_url: string;
    srcset?: string | null;
    avif_srcset?: string | null;
    is_primary: boolean;
    alt: string | null;
  }>;
};

export function ProductCard({ product }: { product: Product }) {
  const primary = product.images?.find((i) => i.is_primary) ?? product.images?.[0] ?? null;
  const stock = useStockState(product.available_qty, product.safety_stock);
  const outOfStock = stock.label === "Agotado";

  return (
    <Card className="h-full">
      <Card.Content className="p-0">
        <Link
          className="relative block aspect-square overflow-hidden rounded-t-[18px] bg-foreground/5"
          params={{ slug: product.slug }}
          to="/producto/$slug"
        >
          {primary ? (
            <picture className="contents">
              {primary.avif_srcset ? (
                <source
                  type="image/avif"
                  srcSet={primary.avif_srcset}
                  sizes="(max-width: 640px) 50vw, 280px"
                />
              ) : null}
              {primary.srcset ? (
                <source
                  type="image/webp"
                  srcSet={primary.srcset}
                  sizes="(max-width: 640px) 50vw, 280px"
                />
              ) : null}
              <img
                alt={primary.alt ?? product.name}
                className="object-cover transition hover:scale-105 size-full"
                loading="lazy"
                decoding="async"
                src={primary.cdn_url}
              />
            </picture>
          ) : (
            <div className="flex h-full items-center justify-center text-foreground/30 text-xs">
              Sin imagen
            </div>
          )}
          <div className="absolute top-2 left-2">
            <Chip color={stock.color} variant="primary">
              {stock.label}
            </Chip>
          </div>
          {product.requires_prescription && (
            <div className="absolute top-2 right-2">
              <Chip color="warning" variant="secondary">
                Receta médica
              </Chip>
            </div>
          )}
        </Link>
      </Card.Content>
      <Card.Header>
        <Card.Description className="text-xs uppercase tracking-wide">
          {product.brand ?? "—"} · SKU {product.sku}
        </Card.Description>
        <Card.Title className="line-clamp-2 text-base">{product.name}</Card.Title>
      </Card.Header>
      <Card.Footer className="flex flex-col items-stretch gap-2">
        <div className="flex flex-col">
          <div className="flex items-baseline gap-2">
            <span className="font-bold text-xl">{CLP_FORMATTER.format(product.price_clp)}</span>
            {product.compare_at_price_clp && product.compare_at_price_clp > product.price_clp && (
              <span className="text-foreground/50 text-sm line-through">
                {CLP_FORMATTER.format(product.compare_at_price_clp)}
              </span>
            )}
          </div>
          <span className="text-foreground/60 text-xs">IVA incluido</span>
        </div>
        <Link params={{ slug: product.slug }} to="/producto/$slug">
          <Button className="w-full" isDisabled={outOfStock} variant="primary">
            {outOfStock ? "No disponible" : "Ver producto"}
          </Button>
        </Link>
      </Card.Footer>
    </Card>
  );
}
