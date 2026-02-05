import { z } from "zod";

import { ApiError } from "./api-client";

export const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

export const zDateString = z.string().regex(dateRegex);
export const zStatusOk = z.object({ status: z.literal("ok") });

export function parseOrThrow<T>(schema: z.ZodType<T>, data: unknown, message: string): T {
  const parsed = schema.safeParse(data);
  if (parsed.success) {
    return parsed.data;
  }
  throw new ApiError(message, 500, parsed.error.issues);
}
