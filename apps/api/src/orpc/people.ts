import { db } from "@finanzas/db";
import {
  findByRutInputSchema,
  findByRutResponseSchema,
  peopleListInputSchema,
  peopleListResponseSchema,
  personDetailResponseSchema,
  personIdSchema,
} from "@finanzas/orpc-contracts/people";
import { OpenAPIHandler } from "@orpc/openapi/fetch";
import { OpenAPIReferencePlugin } from "@orpc/openapi/plugins";
import { ORPCError, onError, os } from "@orpc/server";
import { ZodToJsonSchemaConverter } from "@orpc/zod/zod4";
import type { Context as HonoContext } from "hono";
import { getSessionUser, hasPermission } from "../auth";
import { logError } from "../lib/logger";
import { canonicalRutFilter } from "../lib/rut";
import { configureSuperjson } from "../lib/superjson-config";
import { SuperJSONRPCHandler } from "./superjson";

configureSuperjson();

type PeopleORPCContext = {
  hono: HonoContext;
};

const base = os.$context<PeopleORPCContext>();

const authed = base.use(async ({ context, next }) => {
  const user = await getSessionUser(context.hono);

  if (!user) {
    throw new ORPCError("UNAUTHORIZED", { message: "Unauthorized" });
  }

  return next({
    context: {
      ...context,
      user,
    },
  });
});

const readPeople = authed.use(async ({ context, next }) => {
  const canRead = await hasPermission(context.user, "read", "Person");

  if (!canRead) {
    throw new ORPCError("FORBIDDEN", { message: "Forbidden" });
  }

  return next();
});

const peopleORPCRouterBase = {
  detail: readPeople
    .route({
      method: "GET",
      path: "/{id}",
      summary: "Get person detail",
      tags: ["People"],
    })
    .input(personIdSchema)
    .output(personDetailResponseSchema)
    .handler(async ({ input }) => {
      const person = await db.person.findUnique({
        where: { id: input.id },
        include: {
          employee: true,
          user: true,
        },
      });

      if (!person) {
        throw new ORPCError("NOT_FOUND", { message: "Persona no encontrada" });
      }

      return {
        person: {
          ...person,
          hasUser: Boolean(person.user),
          hasEmployee: Boolean(person.employee),
        },
      };
    }),

  findByRut: readPeople
    .route({
      method: "GET",
      path: "/by-rut",
      summary: "Find a person by RUT (returns null if none)",
      tags: ["People"],
    })
    .input(findByRutInputSchema)
    .output(findByRutResponseSchema)
    .handler(async ({ input }) => {
      const canonical = canonicalRutFilter(input.rut);
      if (!canonical) return { person: null };
      const person = await db.person.findFirst({
        where: { rut: canonical },
        include: { employee: true, user: true, patient: true },
      });
      if (!person) return { person: null };
      return {
        person: {
          ...person,
          hasUser: Boolean(person.user),
          hasEmployee: Boolean(person.employee),
        },
      };
    }),

  list: readPeople
    .route({
      method: "GET",
      path: "/",
      summary: "List people",
      tags: ["People"],
    })
    .input(peopleListInputSchema)
    .output(peopleListResponseSchema)
    .handler(async ({ input }) => {
      const people = await db.person.findMany({
        where: input.includeTest
          ? undefined
          : {
              NOT: {
                OR: [
                  { names: { contains: "Test", mode: "insensitive" } },
                  { names: { contains: "test" } },
                  { rut: { startsWith: "11111111" } },
                  { rut: { startsWith: "TEMP-" } },
                  { email: { contains: "test", mode: "insensitive" } },
                ],
              },
            },
        orderBy: { names: "asc" },
        include: {
          employee: true,
          user: true,
        },
      });

      return {
        status: "ok" as const,
        people: people.map((person) => ({
          ...person,
          hasUser: Boolean(person.user),
          hasEmployee: Boolean(person.employee),
        })),
      };
    }),
};

export const peopleORPCRouter = base.prefix("/api/orpc/people").router(peopleORPCRouterBase);

export const peopleORPCHandler = new SuperJSONRPCHandler(peopleORPCRouter, {
  interceptors: [
    onError((error) => {
      logError(error, {
        module: "api",
        operation: "orpc.people",
      });
    }),
  ],
});

export const peopleOpenAPIHandler = new OpenAPIHandler(peopleORPCRouter, {
  plugins: [
    new OpenAPIReferencePlugin({
      schemaConverters: [new ZodToJsonSchemaConverter()],
      specGenerateOptions: {
        info: {
          title: "Bioalergia People oRPC",
          description: "Contratos oRPC/OpenAPI para personas.",
          version: "1.0.0",
        },
      },
    }),
  ],
  interceptors: [
    onError((error) => {
      logError(error, {
        module: "api",
        operation: "openapi.people",
      });
    }),
  ],
});

export type PeopleORPCRouter = typeof peopleORPCRouter;
