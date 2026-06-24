import { OpenAPIHandler } from "@orpc/openapi/fetch";
import { OpenAPIReferencePlugin } from "@orpc/openapi/plugins";
import {
  addItemInputSchema,
  cartResponseSchema,
  cartStatusResponseSchema,
  removeItemInputSchema,
  updateItemInputSchema,
} from "@finanzas/orpc-contracts/cart";
import { ORPCError, onError, os } from "@orpc/server";
import { ZodToJsonSchemaConverter } from "@orpc/zod/zod4";
import type { Context as HonoContext } from "hono";
import { getCookie, setCookie } from "hono/cookie";

import { logError } from "../lib/logger.ts";
import { configureSuperjson } from "../lib/superjson-config.ts";
import {
  addItemToCart,
  buildCartCookie,
  CART_COOKIE_NAME,
  clearCart,
  createCartWithToken,
  findCartByToken,
  generateCartToken,
  hashCartToken,
  removeItem,
  serializeCart,
  updateItemQty,
} from "../services/cart.ts";
import { SuperJSONRPCHandler } from "./superjson.ts";

configureSuperjson();

type CartORPCContext = { hono: HonoContext };
const base = os.$context<CartORPCContext>();

function isSecureEnv(): boolean {
  return (process.env.NODE_ENV ?? "development") === "production";
}

async function getOrCreateCart(hono: HonoContext) {
  const existingToken = getCookie(hono, CART_COOKIE_NAME);
  if (existingToken) {
    const cart = await findCartByToken(existingToken);
    if (cart) return { cart, token: existingToken, created: false };
  }
  // Generar nuevo token + crear cart en DB + set cookie.
  const { token, hash } = generateCartToken();
  const cart = await createCartWithToken(hash, null);
  const cookie = buildCartCookie(token, isSecureEnv());
  setCookie(hono, cookie.name, cookie.value, {
    maxAge: cookie.maxAge,
    path: cookie.path,
    httpOnly: cookie.httpOnly,
    secure: cookie.secure,
    sameSite: "Lax",
  });
  return { cart, token, created: true };
}

async function reloadCart(hono: HonoContext) {
  const token = getCookie(hono, CART_COOKIE_NAME);
  if (!token) throw new ORPCError("NOT_FOUND", { message: "No hay cart" });
  const cart = await findCartByToken(token);
  if (!cart) throw new ORPCError("NOT_FOUND", { message: "Cart no encontrado" });
  return cart;
}

const getRoute = base
  .route({ method: "GET", path: "/cart", summary: "Get cart", tags: ["Cart"] })
  .output(cartResponseSchema)
  .handler(async ({ context }) => {
    const { cart } = await getOrCreateCart(context.hono);
    return { data: serializeCart(cart), status: "ok" as const };
  });

const addRoute = base
  .route({ method: "POST", path: "/cart/items", summary: "Add item", tags: ["Cart"] })
  .input(addItemInputSchema)
  .output(cartResponseSchema)
  .handler(async ({ input, context }) => {
    const { cart } = await getOrCreateCart(context.hono);
    await addItemToCart({
      cartId: cart.id,
      productId: input.product_id,
      qty: input.qty,
    });
    const fresh = await reloadCart(context.hono);
    return { data: serializeCart(fresh), status: "ok" as const };
  });

const updateRoute = base
  .route({ method: "PUT", path: "/cart/items", summary: "Update item qty", tags: ["Cart"] })
  .input(updateItemInputSchema)
  .output(cartResponseSchema)
  .handler(async ({ input, context }) => {
    const { cart } = await getOrCreateCart(context.hono);
    await updateItemQty({
      cartId: cart.id,
      productId: input.product_id,
      qty: input.qty,
    });
    const fresh = await reloadCart(context.hono);
    return { data: serializeCart(fresh), status: "ok" as const };
  });

const removeRoute = base
  .route({ method: "DELETE", path: "/cart/items", summary: "Remove item", tags: ["Cart"] })
  .input(removeItemInputSchema)
  .output(cartResponseSchema)
  .handler(async ({ input, context }) => {
    const { cart } = await getOrCreateCart(context.hono);
    await removeItem(cart.id, input.product_id);
    const fresh = await reloadCart(context.hono);
    return { data: serializeCart(fresh), status: "ok" as const };
  });

const clearRoute = base
  .route({ method: "POST", path: "/cart/clear", summary: "Clear cart", tags: ["Cart"] })
  .output(cartStatusResponseSchema)
  .handler(async ({ context }) => {
    const token = getCookie(context.hono, CART_COOKIE_NAME);
    if (token) {
      const cart = await findCartByToken(token);
      if (cart) await clearCart(cart.id);
    }
    return { status: "ok" as const };
  });

void hashCartToken; // re-exportable from service if needed elsewhere

const cartORPCRouterBase = {
  get: getRoute,
  addItem: addRoute,
  updateItem: updateRoute,
  removeItem: removeRoute,
  clear: clearRoute,
};

export const cartORPCRouter = base.prefix("/api/orpc/cart").tag("Cart").router(cartORPCRouterBase);

export const cartORPCHandler = new SuperJSONRPCHandler(cartORPCRouter, {
  interceptors: [onError((error) => logError("cart.orpc.rpc", error, {}))],
});

export const cartOpenAPIHandler = new OpenAPIHandler(cartORPCRouter, {
  plugins: [
    new OpenAPIReferencePlugin({
      docsTitle: "Bioalergia Cart API Reference",
      schemaConverters: [new ZodToJsonSchemaConverter()],
      specGenerateOptions: { info: { title: "Bioalergia Cart API", version: "1.0.0" } },
    }),
  ],
  interceptors: [onError((error) => logError("cart.orpc.openapi", error, {}))],
});

export type CartORPCRouter = typeof cartORPCRouter;
