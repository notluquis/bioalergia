import { db } from "@finanzas/db";
import { Hono } from "hono";
import { getSessionUser, hasPermission } from "../auth";
import { reply } from "../utils/reply";

const app = new Hono();

// GET / - List all people
app.get("/", async (c) => {
  const user = await getSessionUser(c);
  if (!user) return reply(c, { status: "error", message: "Unauthorized" }, 401);

  const canRead = await hasPermission(user.id, "read", "Person");
  if (!canRead) return reply(c, { status: "error", message: "Forbidden" }, 403);

  const includeTest = c.req.query("includeTest") === "true";

  try {
    const people = await db.person.findMany({
      where: includeTest
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
        counterpart: true,
        employee: true,
        user: true,
      },
    });

    // Map to include convenience flags
    const mappedPeople = people.map((p) => ({
      ...p,
      hasUser: !!p.user,
      hasEmployee: !!p.employee,
    }));

    return reply(c, { status: "ok", people: mappedPeople });
  } catch (error) {
    console.error("[people] list error:", error);
    return reply(c, { status: "error", message: "Error al listar personas" }, 500);
  }
});

// GET /:id - Get person by ID
app.get("/:id", async (c) => {
  const user = await getSessionUser(c);
  if (!user) return reply(c, { status: "error", message: "Unauthorized" }, 401);

  const canRead = await hasPermission(user.id, "read", "Person");
  if (!canRead) return reply(c, { status: "error", message: "Forbidden" }, 403);

  const id = Number(c.req.param("id"));
  if (!Number.isFinite(id)) {
    return reply(c, { status: "error", message: "ID inválido" }, 400);
  }

  try {
    const person = await db.person.findUnique({
      where: { id },
      include: {
        counterpart: true,
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
        hasUser: !!person.user,
        hasEmployee: !!person.employee,
      },
    });
  } catch (error) {
    console.error("[people] get error:", error);
    return reply(c, { status: "error", message: "Error al obtener persona" }, 500);
  }
});

export default app;
