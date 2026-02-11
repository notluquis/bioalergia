import { zValidator as baseValidator } from "@hono/zod-validator";
import type { ValidationTargets } from "hono";
import type { ZodType } from "zod";
import { z } from "zod";

import { reply } from "../utils/reply";

export const zValidator = <T extends ZodType, Target extends keyof ValidationTargets>(
  target: Target,
  schema: T,
) =>
  baseValidator(target, schema, (result, c) => {
    if (!result.success) {
      const pretty = z.prettifyError(result.error);
      return reply(c, { status: "error", message: pretty, issues: result.error.issues }, 400);
    }
  });
