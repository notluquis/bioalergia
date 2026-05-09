// @finanzas/db/zod — ZenStack Zod schema generation utilities
//
// Usage:
//   import { createSchemaFactory } from "@zenstackhq/zod";
//   import { schema } from "@finanzas/db/zod";
//
//   const schemas = createSchemaFactory(schema);
//
//   // All scalar fields of Employee (strict — no extra props)
//   const employeeSchema = schemas.makeModelSchema("Employee");
//
//   // Select specific fields + a relation
//   const employeeWithPerson = schemas.makeModelSchema("Employee", {
//     select: { id: true, position: true, baseSalary: true, person: true },
//   });
//
//   // All scalars minus sensitive fields
//   const safeUser = schemas.makeModelSchema("User", {
//     omit: { passwordHash: true, mfaSecret: true },
//     include: { person: true },
//   });
//
//   // Create/update schemas (excludes auto-generated + computed fields)
//   const createPayload = schemas.makeModelCreateSchema("Employee");
//   const updatePayload = schemas.makeModelUpdateSchema("Employee");
//
// The factory mirrors ZenStack's select/include/omit vocabulary and stays
// in sync with the generated schema — no manual drift.

// Re-export createSchemaFactory so callers get both pieces from one import path
export { createSchemaFactory } from "@zenstackhq/zod";

// The generated schema definition (heavy type — instantiate lazily per module)
export { schema } from "./zenstack/schema.ts";
