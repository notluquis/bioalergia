import { z } from "zod";

import { ApiError } from "./api-client";

export const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
const dateLikeRegex = /^\d{4}-\d{2}-\d{2}(?:[T ].*)?$/;

export const zDateString = z.string().regex(dateRegex);
export const zApiDateOnly = z
  .union([
    zDateString,
    z.string().regex(dateLikeRegex),
    z.coerce.date().transform((value) => value.toISOString().slice(0, 10)),
  ])
  .transform((value) => value.slice(0, 10));
export const zStatusOk = z.object({ status: z.literal("ok") });

// Drift guard (type-only, zero runtime/bundle cost). Asserts every field of a
// ZenStack model exists in the response-validation schema. If the model gains
// or renames a field, `tsgo` fails type-check in CI — turning silent
// server↔schema drift into a compile error before deploy. Relations present in
// the schema but absent on the model are allowed (model fields ⊆ schema keys).
// Usage:
//   const _guard: SchemaCoversModel<SomeModel, z.infer<typeof SomeSchema>> = true;
//   void _guard;
export type SchemaCoversModel<Model, Inferred> = keyof Model extends keyof Inferred
  ? true
  : { DRIFT__model_fields_missing_from_schema: Exclude<keyof Model, keyof Inferred> };

export function parseOrThrow<T>(schema: z.ZodType<T>, data: unknown, message: string): T {
  const parsed = schema.safeParse(data);
  if (parsed.success) {
    return parsed.data;
  }
  throw new ApiError(message, 500, parsed.error.issues);
}
