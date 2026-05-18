// Carrito server-side: token bearer en cookie httpOnly + Secure + SameSite=Lax.
// Persistimos solo el SHA-256 hash; el token plano viaja únicamente en cookie.
//
// Capacidad por token: lookup cart por hash → si no existe, no hay cart.
// Lookup/create is responsibility of the router (necesita acceso al Hono ctx
// para set-cookie).

import { db } from "@finanzas/db";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

export const CART_COOKIE_NAME = "cart_token";
const COOKIE_MAX_AGE = 30 * 24 * 60 * 60; // 30d
const CART_TTL_DAYS = 14;

export type CartCookieAttrs = {
  name: string;
  value: string;
  maxAge: number;
  path: string;
  httpOnly: true;
  secure: boolean;
  sameSite: "lax";
};

export function generateCartToken(): { token: string; hash: string } {
  const token = randomBytes(32).toString("base64url");
  const hash = createHash("sha256").update(token).digest("hex");
  return { token, hash };
}

export function hashCartToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function buildCartCookie(token: string, secure: boolean): CartCookieAttrs {
  return {
    name: CART_COOKIE_NAME,
    value: token,
    maxAge: COOKIE_MAX_AGE,
    path: "/",
    httpOnly: true,
    secure,
    sameSite: "lax",
  };
}

export async function findCartByToken(token: string) {
  const hash = hashCartToken(token);
  // Timing-safe compare: findUnique en hash es OK, no leakea por timing.
  // (timingSafeEqual relevante solo si comparáramos en código.)
  void timingSafeEqual; // reserved for future custom compare
  return await db.cart.findUnique({
    where: { tokenHash: hash },
    include: {
      items: {
        include: {
          product: {
            include: {
              images: {
                where: { isPrimary: true },
                take: 1,
              },
            },
          },
        },
        orderBy: { id: "asc" },
      },
    },
  });
}

export async function createCartWithToken(tokenHash: string, userId: number | null) {
  return await db.cart.create({
    data: {
      tokenHash,
      userId,
      currency: "CLP",
      expiresAt: new Date(Date.now() + CART_TTL_DAYS * 24 * 60 * 60 * 1000),
    },
    include: {
      items: {
        include: {
          product: { include: { images: { where: { isPrimary: true }, take: 1 } } },
        },
      },
    },
  });
}

export async function addItemToCart(opts: {
  cartId: number;
  productId: number;
  qty: number;
}) {
  const product = await db.product.findUnique({
    where: { id: opts.productId },
    select: { id: true, status: true, priceClp: true, availableQty: true, safetyStock: true },
  });
  if (!product || product.status !== "ACTIVE") {
    throw new Error("Producto no disponible");
  }
  const sellable = product.availableQty - product.safetyStock;
  if (sellable < opts.qty) {
    throw new Error(`Stock insuficiente (disponible: ${Math.max(0, sellable)})`);
  }

  const existing = await db.cartItem.findUnique({
    where: {
      cartId_productId: { cartId: opts.cartId, productId: opts.productId },
    },
  });
  if (existing) {
    const newQty = existing.qty + opts.qty;
    if (sellable < newQty) {
      throw new Error(`Stock insuficiente (disponible: ${Math.max(0, sellable)})`);
    }
    await db.cartItem.update({
      where: { id: existing.id },
      data: { qty: newQty, unitPriceClp: product.priceClp },
    });
  } else {
    await db.cartItem.create({
      data: {
        cartId: opts.cartId,
        productId: opts.productId,
        qty: opts.qty,
        unitPriceClp: product.priceClp,
      },
    });
  }
}

export async function updateItemQty(opts: {
  cartId: number;
  productId: number;
  qty: number;
}) {
  if (opts.qty === 0) {
    await db.cartItem.deleteMany({
      where: { cartId: opts.cartId, productId: opts.productId },
    });
    return;
  }
  const product = await db.product.findUnique({
    where: { id: opts.productId },
    select: { priceClp: true, availableQty: true, safetyStock: true, status: true },
  });
  if (!product || product.status !== "ACTIVE") {
    throw new Error("Producto no disponible");
  }
  const sellable = product.availableQty - product.safetyStock;
  if (sellable < opts.qty) {
    throw new Error(`Stock insuficiente (disponible: ${Math.max(0, sellable)})`);
  }
  await db.cartItem.updateMany({
    where: { cartId: opts.cartId, productId: opts.productId },
    data: { qty: opts.qty, unitPriceClp: product.priceClp },
  });
}

export async function removeItem(cartId: number, productId: number) {
  await db.cartItem.deleteMany({ where: { cartId, productId } });
}

export async function clearCart(cartId: number) {
  await db.cartItem.deleteMany({ where: { cartId } });
}

type CartWithItems = NonNullable<Awaited<ReturnType<typeof findCartByToken>>>;

export function serializeCart(cart: CartWithItems) {
  type CartItem = (typeof cart.items)[number];
  const items = cart.items.map((item: CartItem) => ({
    id: item.id,
    product_id: item.productId,
    qty: item.qty,
    unit_price_clp: item.unitPriceClp,
    product: {
      id: item.product.id,
      sku: item.product.sku,
      slug: item.product.slug,
      name: item.product.name,
      brand: item.product.brand,
      primary_image_url: item.product.images[0]?.cdnUrl ?? null,
      available_qty: item.product.availableQty,
    },
  }));
  type SerializedItem = (typeof items)[number];
  const subtotal = items.reduce(
    (acc: number, i: SerializedItem) => acc + i.unit_price_clp * i.qty,
    0,
  );
  return {
    id: cart.id,
    currency: cart.currency,
    items,
    subtotal_clp: subtotal,
    total_clp: subtotal, // sin shipping ni discounts en MVP cart-view (se calcula en checkout)
    item_count: items.reduce((acc: number, i: SerializedItem) => acc + i.qty, 0),
  };
}
