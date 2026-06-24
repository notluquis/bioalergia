import type { CatalogContract } from "@finanzas/orpc-contracts/catalog";
import { Alert, Breadcrumbs, Button, Card, Chip, Label, NumberField } from "@heroui/react";
import type { InferContractRouterOutputs } from "@orpc/contract";
import { Link } from "@tanstack/react-router";
import { MessageCircle, ShoppingCart } from "lucide-react";

import { contactInfo } from "@/data/clinic";
import { ProductGallery } from "@/features/shop/components/ProductGallery";
import { RelatedProducts } from "@/features/shop/components/RelatedProducts";
import { Reviews } from "@/features/shop/components/Reviews";
import { TrustBlock } from "@/features/shop/components/TrustBlock";
import { hasCompareAtSaving, maxAddableQty } from "@/features/shop/lib/product-detail";
import { CLP_FORMATTER, makeStockState, storefrontUrl } from "@/features/shop/lib/shop-config";

// Presentational view for /producto/$slug. NO data fetching, NO Route.* hooks:
// takes the product + UI state (qty, feedback, added) + callbacks. The route
// wrapper (routes/producto/$slug.tsx) owns the queries/mutation and the JSON-LD
// it injects. The reviews aggregate (a second query) is passed in already
// resolved so this view stays renderer-agnostic.

type CatalogProduct = InferContractRouterOutputs<CatalogContract>["getBySlug"]["data"];

const PHONE = contactInfo.phones[0].replace(/\D/g, "");

export type ReviewsAggregate = { count: number; average: number } | undefined;

export type ProductDetailViewProps = {
  product: CatalogProduct;
  lowStockThreshold: number;
  reviewsAggregate: ReviewsAggregate;
  qty: number;
  onQtyChange: (qty: number) => void;
  isAdding: boolean;
  added: boolean;
  feedback: string | null;
  onAddToCart: (qty: number) => void;
};

export function ProductDetailView({
  product,
  lowStockThreshold,
  reviewsAggregate,
  qty,
  onQtyChange,
  isAdding,
  added,
  feedback,
  onAddToCart,
}: ProductDetailViewProps) {
  type ProductImage = NonNullable<typeof product.images>[number];
  const primary =
    product.images?.find((i: ProductImage) => i.is_primary) ?? product.images?.[0] ?? null;
  const stock = makeStockState(product.available_qty, product.safety_stock, lowStockThreshold);
  const origin = storefrontUrl();
  const outOfStock = stock.label === "Agotado";
  const maxQty = maxAddableQty(product.available_qty, product.safety_stock);
  const whatsappHref = `https://wa.me/${PHONE}?text=${encodeURIComponent(
    `Hola, tengo una consulta sobre "${product.name}" (SKU ${product.sku}).`
  )}`;

  const jsonLd: Record<string, unknown> = {
    "@context": "https://schema.org/",
    "@type": "Product",
    name: product.name,
    sku: product.sku,
    description: product.short_description ?? product.description ?? product.name,
    brand: product.brand ? { "@type": "Brand", name: product.brand } : undefined,
    image: primary?.cdn_url ? [primary.cdn_url] : undefined,
    offers: {
      "@type": "Offer",
      priceCurrency: "CLP",
      price: product.price_clp,
      availability: outOfStock ? "https://schema.org/OutOfStock" : "https://schema.org/InStock",
      url: `${origin}/producto/${product.slug}`,
    },
  };
  if (reviewsAggregate && reviewsAggregate.count > 0) {
    jsonLd.aggregateRating = {
      "@type": "AggregateRating",
      ratingValue: reviewsAggregate.average,
      reviewCount: reviewsAggregate.count,
    };
  }

  const breadcrumbJsonLd = {
    "@context": "https://schema.org/",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Inicio", item: `${origin}/` },
      {
        "@type": "ListItem",
        position: 2,
        name: "Tienda",
        item: `${origin}/tienda`,
      },
      {
        "@type": "ListItem",
        position: 3,
        name: product.name,
        item: `${origin}/producto/${product.slug}`,
      },
    ],
  };

  return (
    <main className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      <script
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        type="application/ld+json"
      />
      <script
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
        type="application/ld+json"
      />

      <Breadcrumbs>
        <Breadcrumbs.Item href="/">Inicio</Breadcrumbs.Item>
        <Breadcrumbs.Item href="/tienda">Tienda</Breadcrumbs.Item>
        <Breadcrumbs.Item>{product.name}</Breadcrumbs.Item>
      </Breadcrumbs>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        <div className="relative">
          <ProductGallery images={product.images ?? []} productName={product.name} />
          <div className="absolute top-3 left-3 z-10 flex gap-2">
            <Chip color={stock.color} variant="primary">
              {stock.label}
            </Chip>
            {product.requires_prescription && (
              <Chip color="warning" variant="secondary">
                Bajo receta médica
              </Chip>
            )}
          </div>
        </div>
        <div className="space-y-5">
          {product.brand && (
            <p className="text-foreground/60 text-sm uppercase tracking-wide">{product.brand}</p>
          )}
          <h1 className="font-bold text-2xl sm:text-3xl">{product.name}</h1>

          <div className="flex flex-col">
            <div className="flex items-baseline gap-3">
              <span className="font-bold text-4xl">{CLP_FORMATTER.format(product.price_clp)}</span>
              {hasCompareAtSaving(product.price_clp, product.compare_at_price_clp) && (
                <span className="text-foreground/50 text-lg line-through">
                  {CLP_FORMATTER.format(product.compare_at_price_clp as number)}
                </span>
              )}
            </div>
            <span className="text-foreground/60 text-sm">IVA incluido</span>
          </div>

          {product.short_description && (
            <p className="text-foreground/80">{product.short_description}</p>
          )}

          {product.description && (
            <Card variant="secondary">
              <Card.Content className="whitespace-pre-line text-sm">
                {product.description}
              </Card.Content>
            </Card>
          )}

          {feedback && (
            <Alert status="danger">
              <Alert.Content>
                <Alert.Description>{feedback}</Alert.Description>
              </Alert.Content>
            </Alert>
          )}

          {added && !isAdding && (
            <Alert status="success">
              <Alert.Content>
                <Alert.Description>
                  Agregado al carrito.{" "}
                  <Link className="underline" to="/carrito">
                    Ver carrito →
                  </Link>
                </Alert.Description>
              </Alert.Content>
            </Alert>
          )}

          {outOfStock ? (
            <Button isDisabled size="lg" variant="secondary">
              Producto agotado
            </Button>
          ) : (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <NumberField
                isDisabled={isAdding}
                maxValue={maxQty}
                minValue={1}
                onChange={(v) => onQtyChange(Number(v))}
                value={qty}
              >
                <Label className="sr-only">Cantidad</Label>
                <NumberField.Group>
                  <NumberField.DecrementButton />
                  <NumberField.Input className="w-16 text-center" />
                  <NumberField.IncrementButton />
                </NumberField.Group>
              </NumberField>

              <Button
                className="flex-1"
                isDisabled={isAdding}
                onPress={() => onAddToCart(qty)}
                size="lg"
                variant="primary"
              >
                <ShoppingCart size={18} />
                {isAdding ? "Agregando…" : "Agregar al carrito"}
              </Button>
            </div>
          )}

          <a
            className="inline-flex items-center gap-2 text-[#25D366] text-sm hover:underline"
            href={whatsappHref}
            rel="noopener noreferrer"
            target="_blank"
          >
            <MessageCircle size={16} /> Consultar por WhatsApp
          </a>

          <Card variant="secondary">
            <Card.Content className="grid grid-cols-2 gap-3 text-xs sm:text-sm">
              <div>
                <p className="text-foreground/50">SKU</p>
                <p className="font-mono">{product.sku}</p>
              </div>
              {product.brand && (
                <div>
                  <p className="text-foreground/50">Laboratorio</p>
                  <p>{product.brand}</p>
                </div>
              )}
              {product.category?.name && (
                <div>
                  <p className="text-foreground/50">Categoría</p>
                  <p>{product.category.name}</p>
                </div>
              )}
              <div>
                <p className="text-foreground/50">Disponibilidad</p>
                <p>{outOfStock ? "Agotado" : `${product.available_qty} unidades`}</p>
              </div>
            </Card.Content>
          </Card>
        </div>
      </div>

      <TrustBlock compact />

      <Reviews productId={product.id} />

      {product.category?.slug && (
        <RelatedProducts categorySlug={product.category.slug} excludeId={product.id} />
      )}

      {/* Sticky add-to-cart bar mobile only (Baymard +12% conversión móvil) */}
      {!outOfStock && (
        <div className="-mx-4 fixed right-0 bottom-0 left-0 z-40 border-foreground/10 border-t bg-surface px-4 py-3 shadow-lg sm:hidden">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="font-bold text-lg">{CLP_FORMATTER.format(product.price_clp)}</p>
              <p className="text-foreground/60 text-xs">IVA incluido</p>
            </div>
            <Button
              isDisabled={isAdding}
              onPress={() => onAddToCart(1)}
              size="lg"
              variant="primary"
            >
              <ShoppingCart size={16} />
              {isAdding ? "Agregando…" : "Agregar"}
            </Button>
          </div>
        </div>
      )}
    </main>
  );
}
