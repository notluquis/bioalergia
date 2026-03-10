import { OpenAPIHandler } from "@orpc/openapi/fetch";
import { OpenAPIReferencePlugin } from "@orpc/openapi/plugins";
import { ORPCError, onError, os } from "@orpc/server";
import { ZodToJsonSchemaConverter } from "@orpc/zod/zod4";
import type { Context as HonoContext } from "hono";
import { z } from "zod";
import { getSessionUser, hasPermission } from "../auth";
import { supplyRequestSchema } from "../lib/inventory-schemas";
import { logError } from "../lib/logger";
import { configureSuperjson } from "../lib/superjson-config";
import {
  createSupplyRequest,
  getCommonSupplies,
  getSupplyRequests,
  updateSupplyRequestStatus,
} from "../services/supplies";
import { SuperJSONRPCHandler } from "./superjson";

configureSuperjson();

type SuppliesORPCContext = {
  hono: HonoContext;
};

const base = os.$context<SuppliesORPCContext>();

const supplyStatusSchema = z.enum(["pending", "ordered", "in_transit", "delivered", "rejected"]);

const commonSupplySchema = z.object({
  brand: z.string().optional(),
  description: z.string().optional(),
  id: z.number().int(),
  model: z.string().optional(),
  name: z.string(),
});

const supplyRequestResponseSchema = z.object({
  admin_notes: z.string().optional(),
  brand: z.string().optional(),
  created_at: z.date(),
  id: z.number().int(),
  model: z.string().optional(),
  notes: z.string().optional(),
  quantity: z.number().int(),
  status: supplyStatusSchema,
  supply_name: z.string(),
  user_email: z.string().optional(),
});

const createSupplyRequestSchema = supplyRequestSchema;

const updateSupplyRequestStatusInputSchema = z.object({
  id: z.number().int().positive(),
  status: supplyStatusSchema,
});

const commonSuppliesResponseSchema = z.object({
  commonSupplies: z.array(commonSupplySchema),
});

const supplyRequestsResponseSchema = z.object({
  requests: z.array(supplyRequestResponseSchema),
});

const statusResponseSchema = z.object({
  status: z.literal("ok"),
});

function toSupplyStatus(value: string) {
  switch (value) {
    case "APPROVED":
      return "ordered" as const;
    case "FULFILLED":
      return "delivered" as const;
    case "PENDING":
      return "pending" as const;
    case "REJECTED":
      return "rejected" as const;
    default:
      return "in_transit" as const;
  }
}

function fromSupplyStatus(value: z.infer<typeof supplyStatusSchema>) {
  switch (value) {
    case "delivered":
      return "FULFILLED";
    case "ordered":
      return "APPROVED";
    case "pending":
      return "PENDING";
    case "rejected":
      return "REJECTED";
    default:
      return "IN_TRANSIT";
  }
}

function toPlainSupplyRequest(request: Awaited<ReturnType<typeof getSupplyRequests>>[number]) {
  const person = request.user?.person;
  return {
    admin_notes: undefined,
    brand: request.brand ?? undefined,
    created_at: request.createdAt,
    id: request.id,
    model: request.model ?? undefined,
    notes: request.notes ?? undefined,
    quantity: request.quantity,
    status: toSupplyStatus(request.status),
    supply_name: request.supplyName,
    user_email: person?.email ?? undefined,
  };
}

const authed = base.use(async ({ context, next }) => {
  const user = await getSessionUser(context.hono);

  if (!user) {
    throw new ORPCError("UNAUTHORIZED", { message: "No autorizado" });
  }

  return next({
    context: {
      ...context,
      user,
    },
  });
});

const readSupplyRequests = authed.use(async ({ context, next }) => {
  const canRead = await hasPermission(context.user.id, "read", "SupplyRequest");

  if (!canRead) {
    throw new ORPCError("FORBIDDEN", { message: "Forbidden" });
  }

  return next();
});

const createSupplyRequests = authed.use(async ({ context, next }) => {
  const canCreate = await hasPermission(context.user.id, "create", "SupplyRequest");

  if (!canCreate) {
    throw new ORPCError("FORBIDDEN", { message: "Forbidden" });
  }

  return next();
});

const updateSupplyRequests = authed.use(async ({ context, next }) => {
  const canUpdate = await hasPermission(context.user.id, "update", "SupplyRequest");

  if (!canUpdate) {
    throw new ORPCError("FORBIDDEN", { message: "Forbidden" });
  }

  return next();
});

const suppliesORPCRouterBase = {
  common: authed
    .route({ method: "GET", path: "/common", summary: "Get common supplies", tags: ["Supplies"] })
    .output(commonSuppliesResponseSchema)
    .handler(async () => {
      const commonSupplies = await getCommonSupplies();

      return {
        commonSupplies: commonSupplies.map((supply) => ({
          brand: supply.brand ?? undefined,
          description: undefined,
          id: supply.id,
          model: supply.model ?? undefined,
          name: supply.name,
        })),
      };
    }),

  createRequest: createSupplyRequests
    .route({
      method: "POST",
      path: "/requests",
      summary: "Create supply request",
      tags: ["Supplies"],
    })
    .input(createSupplyRequestSchema)
    .output(statusResponseSchema)
    .handler(async ({ context, input }) => {
      await createSupplyRequest({
        brand: input.brand,
        model: input.model,
        notes: input.notes,
        quantity: input.quantity,
        supplyName: input.supplyName,
        userId: context.user.id,
      });

      return { status: "ok" as const };
    }),

  requests: readSupplyRequests
    .route({
      method: "GET",
      path: "/requests",
      summary: "Get supply requests",
      tags: ["Supplies"],
    })
    .output(supplyRequestsResponseSchema)
    .handler(async () => {
      const requests = await getSupplyRequests();

      return { requests: requests.map(toPlainSupplyRequest) };
    }),

  updateRequestStatus: updateSupplyRequests
    .route({
      method: "PUT",
      path: "/requests/{id}/status",
      summary: "Update supply request status",
      tags: ["Supplies"],
    })
    .input(updateSupplyRequestStatusInputSchema)
    .output(statusResponseSchema)
    .handler(async ({ input }) => {
      await updateSupplyRequestStatus(input.id, fromSupplyStatus(input.status));
      return { status: "ok" as const };
    }),
};

export const suppliesORPCRouter = base.router(suppliesORPCRouterBase).prefix("/api/orpc/supplies");

export const suppliesORPCHandler = new SuperJSONRPCHandler(suppliesORPCRouter, {
  interceptors: [
    onError((error) => {
      logError(error, {
        module: "api",
        operation: "orpc.supplies",
      });
    }),
  ],
});

export const suppliesOpenAPIHandler = new OpenAPIHandler(suppliesORPCRouter, {
  plugins: [
    new OpenAPIReferencePlugin({
      schemaConverters: [new ZodToJsonSchemaConverter()],
      specGenerateOptions: {
        info: {
          title: "Bioalergia Supplies oRPC",
          description: "Contratos oRPC/OpenAPI para common supplies y supply requests.",
          version: "1.0.0",
        },
      },
    }),
  ],
  interceptors: [
    onError((error) => {
      logError(error, {
        module: "api",
        operation: "openapi.supplies",
      });
    }),
  ],
});
