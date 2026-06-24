import { zValidator as baseValidator } from "@hono/zod-validator";
import type { Env, Input, MiddlewareHandler, ValidationTargets } from "hono";
import type { ZodType, input as zInput, output as zOutput } from "zod";
import { z } from "zod";

import { errorReply } from "../utils/error-reply.ts";

type ValidatorReturn<T extends ZodType, Target extends keyof ValidationTargets> = MiddlewareHandler<
  Env,
  string,
  {
    in: { [K in Target]: zInput<T> };
    out: { [K in Target]: zOutput<T> };
  } & Input
>;

export const zValidator = <T extends ZodType, Target extends keyof ValidationTargets>(
  target: Target,
  schema: T
): ValidatorReturn<T, Target> =>
  baseValidator(target, schema, (result, c) => {
    if (result.success) return;
    const pretty = z.prettifyError(result.error);
    return errorReply(c, 400, pretty, {
      code: "VALIDATION_ERROR",
      details: { issues: result.error.issues },
    });
  }) as ValidatorReturn<T, Target>;
