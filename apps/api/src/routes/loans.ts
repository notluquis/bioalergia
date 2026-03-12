import { Hono } from "hono";
import { z } from "zod";
import { getSessionUser, hasPermission } from "../auth";
import { errorReply } from "../utils/error-reply";
import { reply } from "../utils/reply";
import { zValidator } from "../lib/zod-validator";
import { loanCreateSchema, loanScheduleRegenerateSchema } from "../lib/financial-schemas";
import {
  createLoan,
  deleteLoan,
  getLoanDetail,
  listLoans,
  regenerateLoanSchedules,
  updateLoan,
} from "../services/loans";

const publicIdParamSchema = z.object({
  publicId: z.string().trim().min(1),
});

const app = new Hono();

app.get("/", async (c) => {
  const user = await getSessionUser(c);
  if (!user) {
    return errorReply(c, 401, "Unauthorized");
  }

  const canRead = await hasPermission(user.id, "read", "Loan");
  if (!canRead) {
    return errorReply(c, 403, "Forbidden");
  }

  const loans = await listLoans();
  return reply(c, { loans, status: "ok" });
});

app.post("/", zValidator("json", loanCreateSchema), async (c) => {
  const user = await getSessionUser(c);
  if (!user) {
    return errorReply(c, 401, "Unauthorized");
  }

  const canCreate = await hasPermission(user.id, "create", "Loan");
  if (!canCreate) {
    return errorReply(c, 403, "Forbidden");
  }

  const loan = await createLoan(c.req.valid("json"));
  return reply(c, { ...loan, status: "ok" }, 201);
});

app.get("/:publicId", zValidator("param", publicIdParamSchema), async (c) => {
  const user = await getSessionUser(c);
  if (!user) {
    return errorReply(c, 401, "Unauthorized");
  }

  const canRead = await hasPermission(user.id, "read", "Loan");
  if (!canRead) {
    return errorReply(c, 403, "Forbidden");
  }

  const { publicId } = c.req.valid("param");
  const loan = await getLoanDetail(publicId);
  return reply(c, { ...loan, status: "ok" });
});

app.put(
  "/:publicId",
  zValidator("param", publicIdParamSchema),
  zValidator("json", loanCreateSchema.partial()),
  async (c) => {
    const user = await getSessionUser(c);
    if (!user) {
      return errorReply(c, 401, "Unauthorized");
    }

    const canUpdate = await hasPermission(user.id, "update", "Loan");
    if (!canUpdate) {
      return errorReply(c, 403, "Forbidden");
    }

    const { publicId } = c.req.valid("param");
    const loan = await updateLoan(publicId, c.req.valid("json"));
    return reply(c, { ...loan, status: "ok" });
  }
);

app.delete("/:publicId", zValidator("param", publicIdParamSchema), async (c) => {
  const user = await getSessionUser(c);
  if (!user) {
    return errorReply(c, 401, "Unauthorized");
  }

  const canDelete = await hasPermission(user.id, "delete", "Loan");
  if (!canDelete) {
    return errorReply(c, 403, "Forbidden");
  }

  const { publicId } = c.req.valid("param");
  await deleteLoan(publicId);
  return reply(c, { status: "ok" });
});

app.post(
  "/:publicId/schedules",
  zValidator("param", publicIdParamSchema),
  zValidator("json", loanScheduleRegenerateSchema),
  async (c) => {
    const user = await getSessionUser(c);
    if (!user) {
      return errorReply(c, 401, "Unauthorized");
    }

    const canUpdate = await hasPermission(user.id, "update", "Loan");
    if (!canUpdate) {
      return errorReply(c, 403, "Forbidden");
    }

    const { publicId } = c.req.valid("param");
    const loan = await regenerateLoanSchedules(publicId, c.req.valid("json"));
    return reply(c, { ...loan, status: "ok" });
  }
);

export const loanRoutes = app;
