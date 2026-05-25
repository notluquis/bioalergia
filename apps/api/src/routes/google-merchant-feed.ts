// Google Merchant XML feed (RSS 2.0 + g: namespace). Sirve productos
// ACTIVE con stock disponible para Google Shopping / Performance Max.
//
// Endpoint: GET /feed/google-merchant.xml
// Configurar en Google Merchant Center → Products → Feeds → URL fetch:
//   https://api.bioalergia.cl/feed/google-merchant.xml
// Frecuencia recomendada: cada 24h (Google permite 2x/día).
//
// Estándar referencia:
// https://support.google.com/merchants/answer/7052112
//
// Sin auth — feed público (Google bot).

import type { Hono } from "hono";

import { db } from "@finanzas/db";

const STOREFRONT = (process.env.STOREFRONT_BASE_URL ?? "https://bioalergia.cl").replace(/\/+$/, "");

function esc(s: string | null | undefined): string {
  if (!s) return "";
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

export function registerGoogleMerchantFeed(app: Hono): void {
  app.get("/feed/google-merchant.xml", async (c) => {
    const products = await db.product.findMany({
      where: { status: "ACTIVE" },
      include: {
        category: true,
        images: { orderBy: { position: "asc" }, take: 5 },
      },
      orderBy: { id: "asc" },
    });

    type Row = (typeof products)[number];
    type Img = Row["images"][number];
    const items = products
      .map((p: Row) => {
        const primary = p.images.find((i: Img) => i.isPrimary) ?? p.images[0];
        const additionalImages = p.images
          .filter((i: Img) => i !== primary)
          .slice(0, 10)
          .map(
            (i: Img) => `      <g:additional_image_link>${esc(i.cdnUrl)}</g:additional_image_link>`
          )
          .join("\n");
        const availability = p.availableQty - p.safetyStock > 0 ? "in_stock" : "out_of_stock";
        return `    <item>
      <g:id>${esc(p.sku)}</g:id>
      <g:title>${esc(p.name)}</g:title>
      <g:description>${esc(p.shortDescription ?? p.description ?? p.name)}</g:description>
      <g:link>${STOREFRONT}/producto/${esc(p.slug)}</g:link>
      <g:image_link>${esc(primary?.cdnUrl ?? "")}</g:image_link>
${additionalImages}
      <g:availability>${availability}</g:availability>
      <g:price>${p.priceClp} CLP</g:price>
      <g:brand>${esc(p.brand ?? "Bioalergia")}</g:brand>
      <g:condition>new</g:condition>
      <g:identifier_exists>${p.barcode ? "yes" : "no"}</g:identifier_exists>
${p.barcode ? `      <g:gtin>${esc(p.barcode)}</g:gtin>` : ""}
      <g:product_type>${esc(p.category?.name ?? "General")}</g:product_type>
      <g:adult>no</g:adult>
      <g:shipping>
        <g:country>CL</g:country>
        <g:service>Chilexpress Estándar</g:service>
        <g:price>3990 CLP</g:price>
      </g:shipping>
    </item>`;
      })
      .join("\n");

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
  <channel>
    <title>Tienda Bioalergia</title>
    <link>${STOREFRONT}/tienda</link>
    <description>Productos seleccionados para el cuidado de la piel, hidratación y bienestar.</description>
${items}
  </channel>
</rss>
`;

    return c.body(xml, 200, {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600", // 1h CDN cache
    });
  });
}
