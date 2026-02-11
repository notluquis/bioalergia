import { db } from "@finanzas/db";
import { Hono } from "hono";
import { z } from "zod";
import { getSessionUser, hasPermission } from "../auth";
import { zValidator } from "../lib/zod-validator";
import { reply } from "../utils/reply";

const app = new Hono();

// ============================================================
// SCHEMAS
// ============================================================

const listPeopleQuerySchema = z.object({
  includeTest: z.enum(["true", "false"]).optional(),
});

const peopleParamSchema = z.object({
  id: z.string().regex(/^\d+$/, "ID debe ser numérico").transform(Number),
});

// ============================================================
// ROUTES
// ============================================================

// GET / - List all people
app.get("/", zValidator("query", listPeopleQuerySchema), async (c) => {
  const user = await getSessionUser(c);
  if (!user) {
    return reply(c, { status: "error", message: "Unauthorized" }, 401);
  }

  const canRead = await hasPermission(user.id, "read", "Person");
  if (!canRead) {
    return reply(c, { status: "error", message: "Forbidden" }, 403);
  }

  const { includeTest } = c.req.valid("query");

  try {
    const people = await db.person.findMany({
      where:
        includeTest === "true"
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

    // Map to include convenience flags
    const mappedPeople = people.map((p) => ({
      ...p,
      hasUser: Boolean(p.user),
      hasEmployee: Boolean(p.employee),
    }));

    return reply(c, { status: "ok", people: mappedPeople });
  } catch (error) {
    console.error("[people] list error:", error);
    return reply(c, { status: "error", message: "Error al listar personas" }, 500);
  }
});

// GET /:id - Get person by ID
app.get("/:id", zValidator("param", peopleParamSchema), async (c) => {
  const user = await getSessionUser(c);
  if (!user) {
    return reply(c, { status: "error", message: "Unauthorized" }, 401);
  }

  const canRead = await hasPermission(user.id, "read", "Person");
  if (!canRead) {
    return reply(c, { status: "error", message: "Forbidden" }, 403);
  }

  const { id } = c.req.valid("param");

  try {
    const person = await db.person.findUnique({
      where: { id },
      include: {
        employee: true,
        user: true,
      },
    });

    if (!person) {
      return reply(c, { status: "error", message: "Persona no encontrada" }, 404);
    }

    return reply(c, {
      person: {
        ...person,
        hasUser: Boolean(person.user),
        hasEmployee: Boolean(person.employee),
      },
    });
  } catch (error) {
    console.error("[people] get error:", error);
    return reply(c, { status: "error", message: "Error al obtener persona" }, 500);
  }
});

export const peopleRoutes = app;
