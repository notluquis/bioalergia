import { Hono } from "hono";
import { getSessionUser } from "../auth";
import { db } from "@finanzas/db";

const app = new Hono();

// GET / - List all people
app.get("/", async (c) => {
  const user = getSessionUser(c);
  if (!user) return c.json({ status: "error", message: "Unauthorized" }, 401);

  try {
    const people = await db.person.findMany({
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

    return c.json({ status: "ok", people: mappedPeople });
  } catch (error) {
    console.error("[people] list error:", error);
    return c.json(
      { status: "error", message: "Error al listar personas" },
      500
    );
  }
});

// GET /:id - Get person by ID
app.get("/:id", async (c) => {
  const user = getSessionUser(c);
  if (!user) return c.json({ status: "error", message: "Unauthorized" }, 401);

  const id = Number(c.req.param("id"));
  if (!Number.isFinite(id)) {
    return c.json({ status: "error", message: "ID inválido" }, 400);
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
      return c.json({ status: "error", message: "Persona no encontrada" }, 404);
    }

    return c.json({
      person: {
        ...person,
        hasUser: !!person.user,
        hasEmployee: !!person.employee,
      },
    });
  } catch (error) {
    console.error("[people] get error:", error);
    return c.json(
      { status: "error", message: "Error al obtener persona" },
      500
    );
  }
});

export default app;
