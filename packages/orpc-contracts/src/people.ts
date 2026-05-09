import { oc } from "@orpc/contract";
import { z } from "zod";

export const peopleListInputSchema = z.object({
  includeTest: z.boolean().optional(),
});

export const personIdSchema = z.object({
  id: z.number().int(),
});

export const personSchema = z
  .object({
    birthDate: z.string().nullable().optional(),
    createdAt: z.coerce.date(),
    email: z.string().nullable(),
    employee: z.unknown().nullable().optional(),
    fatherName: z.string().nullable(),
    gender: z.string().nullable().optional(),
    hasEmployee: z.boolean().optional(),
    hasUser: z.boolean().optional(),
    id: z.number().int(),
    motherName: z.string().nullable(),
    names: z.string(),
    personType: z.enum(["JURIDICAL", "NATURAL"]),
    rut: z.string().nullable(),
    updatedAt: z.coerce.date(),
    user: z.unknown().nullable().optional(),
  })
  .passthrough();

export const peopleListResponseSchema = z.object({
  people: z.array(personSchema),
  status: z.literal("ok"),
});

export const personDetailResponseSchema = z.object({
  person: personSchema,
});

export const findByRutInputSchema = z.object({
  rut: z.string().min(1),
});

export const findByRutResponseSchema = z.object({
  person: personSchema.nullable(),
});

export const peopleContract = {
  detail: oc.route({ method: "GET", path: "/{id}" }).input(personIdSchema).output(personDetailResponseSchema),
  findByRut: oc.route({ method: "GET", path: "/by-rut" }).input(findByRutInputSchema).output(findByRutResponseSchema),
  list: oc.route({ method: "GET", path: "/" }).input(peopleListInputSchema).output(peopleListResponseSchema),
};

export type PeopleContract = typeof peopleContract;
