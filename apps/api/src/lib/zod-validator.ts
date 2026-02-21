import { zValidator as baseValidator } from "@hono/zod-validator";
import type { ValidationTargets } from "hono";
import type { ZodType } from "zod";
import { z } from "zod";

import { errorReply } from "../utils/error-reply";

export const zValidator = <T extends ZodType, Target extends keyof ValidationTargets>(
  target: Target,
  schema: T,
) =>
  baseValidator(target, schema, (result, c) => {
    if (!result.success) {
      const pretty = z.prettifyError(result.error);
      return errorReply(c, 400, pretty, {
        code: "VALIDATION_ERROR",
        details: { issues: result.error.issues },
      });
    }
  });
