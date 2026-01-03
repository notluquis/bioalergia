// server/middleware/authorize.ts

import { ForbiddenError } from "@casl/ability";
import { ExtractSubjectType } from "@casl/ability";
import { NextFunction, Response } from "express";

import { AppSubjects } from "../lib/authz/ability.js";
import { AuthenticatedRequest } from "../types.js";

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
        console.warn(`[authorize] Access denied. Action: ${action}, Subject: ${subject}`);
        return res.status(403).json({
          status: "error",
          message: "You are not authorized to perform this action.",
        });
      }
      console.error(`[authorize] Unexpected error. Action: ${action}, Subject: ${subject}:`, error);
      return next(error);
    }
  };
}
