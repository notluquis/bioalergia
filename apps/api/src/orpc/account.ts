import {
  accountDeleteAddressInputSchema,
  accountMyAddressesResponseSchema,
  accountMyOrderByNumberInputSchema,
  accountMyOrderByNumberResponseSchema,
  accountMyOrdersInputSchema,
  accountMyOrdersResponseSchema,
  accountRepurchaseInputSchema,
  accountRepurchaseResponseSchema,
  accountStatusResponseSchema,
  accountUpsertAddressInputSchema,
  accountUpsertAddressResponseSchema,
} from "@finanzas/orpc-contracts/account";
import { ORPCError, onError, os } from "@orpc/server";
import type { Context as HonoContext } from "hono";
import { getCookie, setCookie } from "hono/cookie";

import { getSiteSessionUser } from "../lib/auth.ts";
import { logError } from "../lib/logger.ts";
import { configureSuperjson } from "../lib/superjson-config.ts";
import {
  deleteMyAddress,
  getMyOrderByNumber,
  getPersonIdForUser,
  getRepurchaseOrder,
  linkCartToUser,
  listMyAddresses,
  listMyOrders,
  repurchaseOrderItems,
  upsertMyAddress,
} from "../services/account.ts";
import {
  buildCartCookie,
  CART_COOKIE_NAME,
  createCartWithToken,
  findCartByToken,
  generateCartToken,
} from "../services/cart.ts";
import { SuperJSONRPCHandler } from "./superjson.ts";

configureSuperjson();

type AccountContext = { hono: HonoContext };
const base = os.$context<AccountContext>();

// La sesión del SITE (shop bioalergia.cl) NO es la auth de la intranet; se
// resuelve acá en el handler (es el boundary de autenticación). Cada handler
// pasa `session.id` al service, que scopea cada query a ese cliente.
async function requireSession(hono: HonoContext) {
  const session = await getSiteSessionUser(hono);
  if (!session) {
    throw new ORPCError("UNAUTHORIZED", { message: "No autorizado" });
  }
  return session;
}

const myOrdersRoute = base
  .route({ method: "POST", path: "/orders", tags: ["Account"] })
  .input(accountMyOrdersInputSchema)
  .output(accountMyOrdersResponseSchema)
  .handler(async ({ context, input }) => {
    const session = await requireSession(context.hono);
    const result = await listMyOrders(session.id, input);
    return { status: "ok" as const, ...result };
  });

const myOrderByNumberRoute = base
  .route({ method: "POST", path: "/orders/by-number", tags: ["Account"] })
  .input(accountMyOrderByNumberInputSchema)
  .output(accountMyOrderByNumberResponseSchema)
  .handler(async ({ context, input }) => {
    const session = await requireSession(context.hono);
    const result = await getMyOrderByNumber(session.id, input);
    return { status: "ok" as const, ...result };
  });

const myAddressesRoute = base
  .route({ method: "GET", path: "/addresses", tags: ["Account"] })
  .output(accountMyAddressesResponseSchema)
  .handler(async ({ context }) => {
    const session = await requireSession(context.hono);
    const result = await listMyAddresses(session.id);
    return { status: "ok" as const, ...result };
  });

const upsertAddressRoute = base
  .route({ method: "POST", path: "/addresses/upsert", tags: ["Account"] })
  .input(accountUpsertAddressInputSchema)
  .output(accountUpsertAddressResponseSchema)
  .handler(async ({ context, input }) => {
    const session = await requireSession(context.hono);
    const personId = await getPersonIdForUser(session.id);
    if (!personId) {
      // Verdadero 500 (no es un error de cliente): el INTERNAL original queda
      // como ORPCError en el handler — DomainError no tiene kind INTERNAL.
      throw new ORPCError("INTERNAL_SERVER_ERROR", { message: "Cuenta sin persona vinculada" });
    }
    const result = await upsertMyAddress(session.id, personId, input);
    return { status: "ok" as const, ...result };
  });

const deleteAddressRoute = base
  .route({ method: "POST", path: "/addresses/delete", tags: ["Account"] })
  .input(accountDeleteAddressInputSchema)
  .output(accountStatusResponseSchema)
  .handler(async ({ context, input }) => {
    const session = await requireSession(context.hono);
    await deleteMyAddress(session.id, input.id);
    return { status: "ok" as const };
  });

const repurchaseRoute = base
  .route({ method: "POST", path: "/repurchase", tags: ["Account"] })
  .input(accountRepurchaseInputSchema)
  .output(accountRepurchaseResponseSchema)
  .handler(async ({ context, input }) => {
    const session = await requireSession(context.hono);
    const order = await getRepurchaseOrder(session.id, input.orderNumber);
    // Orquestación de cookies/carrito ligada al Hono context — queda en el
    // handler. Ensure user has a cart (linked to the session). Create one if missing.
    let cartToken = getCookie(context.hono, CART_COOKIE_NAME);
    let cart = cartToken ? await findCartByToken(cartToken) : null;
    if (!cart) {
      const { token, hash } = generateCartToken();
      cart = await createCartWithToken(hash, session.id);
      cartToken = token;
      const cookie = buildCartCookie(token, process.env.NODE_ENV === "production");
      setCookie(context.hono, cookie.name, cookie.value, {
        maxAge: cookie.maxAge,
        path: cookie.path,
        httpOnly: cookie.httpOnly,
        secure: cookie.secure,
        sameSite: "Lax",
      });
    } else if (cart.userId === null) {
      await linkCartToUser(cart.id, session.id);
    }

    const data = await repurchaseOrderItems(cart.id, order);
    return { status: "ok" as const, data };
  });

const accountRouterBase = {
  myOrders: myOrdersRoute,
  myOrderByNumber: myOrderByNumberRoute,
  myAddresses: myAddressesRoute,
  upsertAddress: upsertAddressRoute,
  deleteAddress: deleteAddressRoute,
  repurchase: repurchaseRoute,
};

export const accountORPCRouter = base
  .prefix("/api/orpc/account")
  .tag("Account")
  .router(accountRouterBase);

export const accountORPCHandler = new SuperJSONRPCHandler(accountORPCRouter, {
  interceptors: [onError((error) => logError("account.orpc.rpc", error, {}))],
});

export type AccountORPCRouter = typeof accountORPCRouter;
