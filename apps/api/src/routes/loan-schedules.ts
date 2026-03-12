import { Hono } from "hono";
import { z } from "zod";
import { getSessionUser, hasPermission } from "../auth";
import { loanPaymentSchema } from "../lib/financial-schemas";
import { zValidator } from "../lib/zod-validator";
import { registerLoanPayment, unlinkLoanPayment } from "../services/loans";
import { errorReply } from "../utils/error-reply";
import { reply } from "../utils/reply";

const app = new Hono();

const scheduleIdParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

app.post(
  "/:id/pay",
  zValidator("param", scheduleIdParamSchema),
  zValidator("json", loanPaymentSchema),
  async (c) => {
    const user = await getSessionUser(c);
    if (!user) {
      return errorReply(c, 401, "Unauthorized");
    }

    const canUpdate = await hasPermission(user.id, "update", "Loan");
    if (!canUpdate) {
      return errorReply(c, 403, "Forbidden");
    }

    const { id } = c.req.valid("param");
    const schedule = await registerLoanPayment(id, c.req.valid("json"));
    return reply(c, { schedule, status: "ok" });
  }
);

app.post("/:id/unlink", zValidator("param", scheduleIdParamSchema), async (c) => {
  const user = await getSessionUser(c);
  if (!user) {
    return errorReply(c, 401, "Unauthorized");
  }

  const canUpdate = await hasPermission(user.id, "update", "Loan");
  if (!canUpdate) {
    return errorReply(c, 403, "Forbidden");
  }

  const { id } = c.req.valid("param");
  const schedule = await unlinkLoanPayment(id);
  return reply(c, { schedule, status: "ok" });
});

export const loanScheduleRoutes = app;
