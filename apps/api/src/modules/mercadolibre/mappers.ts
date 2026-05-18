// Mapea un Product PG → payload para POST /items de ML.

import type { MlItemCreatePayload } from "./client.ts";

type ProductForMl = {
  name: string;
  description: string | null;
  shortDescription: string | null;
  priceClp: number;
  sku: string;
  availableQty: number;
  brand: string | null;
  images: Array<{ cdnUrl: string }>;
};

const DEFAULT_LISTING_TYPE = process.env.ML_LISTING_TYPE_ID ?? "gold_special";

export function productToMlItem(
  product: ProductForMl,
  mlCategoryId: string
): MlItemCreatePayload {
  const attributes: MlItemCreatePayload["attributes"] = [];
  if (product.brand) {
    attributes.push({ id: "BRAND", value_name: product.brand });
  }
  attributes.push({ id: "SELLER_SKU", value_name: product.sku });

  const description = product.description ?? product.shortDescription ?? product.name;

  return {
    title: product.name.slice(0, 60), // ML hard limit 60 chars
    category_id: mlCategoryId,
    price: product.priceClp,
    currency_id: "CLP",
    available_quantity: Math.max(0, product.availableQty),
    buying_mode: "buy_it_now",
    condition: "new",
    listing_type_id: DEFAULT_LISTING_TYPE,
    description: { plain_text: description },
    pictures: product.images.map((img) => ({ source: img.cdnUrl })),
    attributes,
    seller_custom_field: product.sku,
  };
}
