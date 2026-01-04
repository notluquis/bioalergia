import { Hono } from "hono";
import { getSessionUser } from "../auth";
import {
  createService,
  deleteService,
  getServiceById,
  listServices,
  updateService,
} from "../services/services";
import {
  serviceCreateSchema,
  serviceUpdateSchema,
} from "../lib/entity-schemas";

const app = new Hono();

app.get("/", async (c) => {
  const user = getSessionUser(c);
  if (!user) return c.json({ status: "error", message: "Unauthorized" }, 401);

  const items = await listServices();
  return c.json(items);
});

app.get("/:id", async (c) => {
  const user = getSessionUser(c);
  if (!user) return c.json({ status: "error", message: "Unauthorized" }, 401);

  const id = Number(c.req.param("id"));
  if (isNaN(id)) return c.json({ status: "error", message: "Invalid ID" }, 400);

  const item = await getServiceById(id);
  if (!item) return c.json({ status: "error", message: "Not found" }, 404);

  return c.json(item);
});

app.post("/", async (c) => {
  const user = getSessionUser(c);
  if (!user) return c.json({ status: "error", message: "Unauthorized" }, 401);

  const body = await c.req.json();
  const parsed = serviceCreateSchema.safeParse(body);

  if (!parsed.success) {
    return c.json(
      { status: "error", message: "Invalid data", issues: parsed.error.issues },
      400
    );
  }

  const result = await createService(parsed.data);
  return c.json(result);
});

app.put("/:id", async (c) => {
  const user = getSessionUser(c);
  if (!user) return c.json({ status: "error", message: "Unauthorized" }, 401);

  const id = Number(c.req.param("id"));
  if (isNaN(id)) return c.json({ status: "error", message: "Invalid ID" }, 400);

  const body = await c.req.json();
  const parsed = serviceUpdateSchema.safeParse(body);

  if (!parsed.success) {
    return c.json(
      { status: "error", message: "Invalid data", issues: parsed.error.issues },
      400
    );
  }

  const result = await updateService(id, parsed.data);
  return c.json(result);
});

app.delete("/:id", async (c) => {
  const user = getSessionUser(c);
  if (!user) return c.json({ status: "error", message: "Unauthorized" }, 401);

  const id = Number(c.req.param("id"));
  if (isNaN(id)) return c.json({ status: "error", message: "Invalid ID" }, 400);

  await deleteService(id);
  return c.json({ status: "ok" });
});

export default app;
