import { Button, Card, Chip } from "@heroui/react";
import { Link } from "@tanstack/react-router";

const CLP = new Intl.NumberFormat("es-CL", {
  style: "currency",
  currency: "CLP",
  maximumFractionDigits: 0,
});

type Product = {
  id: number;
  slug: string;
  sku: string;
  name: string;
  brand: string | null;
  price_clp: number;
  compare_at_price_clp: number | null;
  available_qty: number;
  images?: Array<{ cdn_url: string; is_primary: boolean; alt: string | null }>;
};

export function ProductCard({ product }: { product: Product }) {
  const primary =
    product.images?.find((i) => i.is_primary) ?? product.images?.[0] ?? null;
  const outOfStock = product.available_qty <= 0;

  return (
    <Card className="h-full">
      <Card.Content className="p-0">
        <Link
          className="block aspect-square overflow-hidden rounded-t-[18px] bg-foreground/5"
          params={{ slug: product.slug }}
          to="/producto/$slug"
        >
          {primary ? (
            <img
              alt={primary.alt ?? product.name}
              className="h-full w-full object-cover transition hover:scale-105"
              loading="lazy"
              src={primary.cdn_url}
            />
          ) : (
            <div className="flex h-full items-center justify-center text-foreground/30 text-xs">
              Sin imagen
            </div>
          )}
        </Link>
      </Card.Content>
      <Card.Header>
        <Card.Description className="text-xs uppercase">
          {product.brand ?? "—"}
        </Card.Description>
        <Card.Title className="text-base">{product.name}</Card.Title>
      </Card.Header>
      <Card.Footer className="flex flex-col items-stretch gap-2">
        <div className="flex items-baseline gap-2">
          <span className="font-bold text-lg">{CLP.format(product.price_clp)}</span>
          {product.compare_at_price_clp && product.compare_at_price_clp > product.price_clp && (
            <span className="text-foreground/50 text-sm line-through">
              {CLP.format(product.compare_at_price_clp)}
            </span>
          )}
        </div>
        {outOfStock ? (
          <Chip variant="soft">Agotado</Chip>
        ) : (
          <Button
            as={Link}
            params={{ slug: product.slug }}
            to="/producto/$slug"
            variant="primary"
          >
            Ver producto
          </Button>
        )}
      </Card.Footer>
    </Card>
  );
}
