import { db } from "@finanzas/db";
import { OpenAPIHandler } from "@orpc/openapi/fetch";
import { OpenAPIReferencePlugin } from "@orpc/openapi/plugins";
import { ORPCError, onError, os } from "@orpc/server";
import { ZodToJsonSchemaConverter } from "@orpc/zod/zod4";
import type { Context as HonoContext } from "hono";
import { z } from "zod";
import { getSessionUser, hasPermission } from "../auth";
import { logError } from "../lib/logger";
import { configureSuperjson } from "../lib/superjson-config";
import { SuperJSONRPCHandler } from "./superjson";

configureSuperjson();

type PeopleORPCContext = {
  hono: HonoContext;
};

const base = os.$context<PeopleORPCContext>();

const peopleListInputSchema = z.object({
  includeTest: z.boolean().optional(),
});

const personIdSchema = z.object({
  id: z.number().int(),
});

const personSchema = z
  .object({
    birthDate: z.string().nullable().optional(),
    createdAt: z.date(),
    email: z.string().nullable(),
    employee: z.unknown().nullable().optional(),
    fatherName: z.string().nullable(),
    gender: z.string().nullable().optional(),
    hasEmployee: z.boolean().optional(),
    hasUser: z.boolean().optional(),
    id: z.number().int(),
    motherName: z.string().nullable(),
    names: z.string(),
    personType: z.enum(["JURIDICAL", "NATURAL"]),
    rut: z.string(),
    updatedAt: z.date(),
    user: z.unknown().nullable().optional(),
  })
  .passthrough();

const peopleListResponseSchema = z.object({
  people: z.array(personSchema),
  status: z.literal("ok"),
});

const personDetailResponseSchema = z.object({
  person: personSchema,
});

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
  const canRead = await hasPermission(context.user.id, "read", "Person");

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
      summary: "Get person by id",
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

export const peopleORPCRouter = base.router(peopleORPCRouterBase).prefix("/api/orpc/people");

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
