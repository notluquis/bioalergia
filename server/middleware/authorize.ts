// server/middleware/authorize.ts

import { ForbiddenError } from "@casl/ability";
import { AuthenticatedRequest } from "../types.js";
import { AppSubjects } from "../lib/authz/ability.js";
import { ExtractSubjectType } from "@casl/ability";
import { Response, NextFunction } from "express";

export function authorize(action: string, subject: ExtractSubjectType<AppSubjects>) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.ability) {
        throw new Error("req.ability is not defined. Ensure attachAbility middleware is used.");
      }
      ForbiddenError.from(req.ability).throwUnlessCan(action, subject);
      return next();
    } catch (error) {
      if (error instanceof ForbiddenError) {
        return res.status(403).json({
          status: "error",
          message: "You are not authorized to perform this action.",
        });
      }
      return next(error);
    }
  };
}
