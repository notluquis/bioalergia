import {
  closeNonconformityInputSchema,
  createOperationalRegisterInputSchema,
  listOperationalRegistersInputSchema,
  operationalRegisterSchema,
  operationalRegistersResponseSchema,
} from "@finanzas/orpc-contracts/operational-registers";
import { ORPCError, onError, os } from "@orpc/server";
import type { Context as HonoContext } from "hono";
import type { z } from "zod";
import { getSessionUser, hasPermission } from "../lib/auth.ts";
import { logError } from "../lib/logger.ts";
import { configureSuperjson } from "../lib/superjson-config.ts";
import {
  closeNonconformity,
  createOperationalRegister,
  listOperationalRegisters,
} from "../services/operational-registers.ts";
import { SuperJSONRPCHandler } from "./superjson.ts";

configureSuperjson();

type OperationalRegistersORPCContext = {
  hono: HonoContext;
};

const base = os.$context<OperationalRegistersORPCContext>();

const authed = base.use(async ({ context, next }) => {
  const user = await getSessionUser(context.hono);
  if (!user) throw new ORPCError("UNAUTHORIZED", { message: "No autorizado" });
  return next({ context: { ...context, user } });
});

// Registros operativos: subject CASL dedicado `OperationalRegister` (staff
// interno). No hay endpoint público.
function requirePermission(action: string) {
  return authed.use(async ({ context, next }) => {
    const ok = await hasPermission(context.user, action, "OperationalRegister");
    if (!ok) throw new ORPCError("FORBIDDEN", { message: "Forbidden" });
    return next();
  });
}

const readRegisters = requirePermission("read");
const createRegisters = requirePermission("create");
const updateRegisters = requirePermission("update");

const operationalRegistersORPCRouterBase = {
  create: createRegisters
    .route({ method: "POST", path: "/registers" })
    .input(createOperationalRegisterInputSchema)
    .output(operationalRegisterSchema)
    .handler(
      async ({
        input,
        context,
      }: {
        input: z.infer<typeof createOperationalRegisterInputSchema>;
        context: OperationalRegistersORPCContext & { user: { id: number } };
      }) => createOperationalRegister(input, context.user.id)
    ),

  list: readRegisters
    .route({ method: "GET", path: "/registers" })
    .input(listOperationalRegistersInputSchema)
    .output(operationalRegistersResponseSchema)
    .handler(async ({ input }: { input: z.infer<typeof listOperationalRegistersInputSchema> }) =>
      listOperationalRegisters(input)
    ),

  closeNonconformity: updateRegisters
    .route({ method: "POST", path: "/registers/close-nonconformity" })
    .input(closeNonconformityInputSchema)
    .output(operationalRegisterSchema)
    .handler(async ({ input }: { input: z.infer<typeof closeNonconformityInputSchema> }) =>
      closeNonconformity(input)
    ),
};

export const operationalRegistersORPCRouter = base
  .prefix("/api/orpc/operational-registers")
  .router(operationalRegistersORPCRouterBase);

export const operationalRegistersORPCHandler = new SuperJSONRPCHandler(
  operationalRegistersORPCRouter,
  {
    interceptors: [
      onError((error) => {
        logError(error, { module: "api", operation: "orpc.operational-registers" });
      }),
    ],
  }
);

export type OperationalRegistersORPCRouter = typeof operationalRegistersORPCRouter;
