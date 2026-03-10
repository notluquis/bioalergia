import { queryOptions } from "@tanstack/react-query";
import { z } from "zod";
import type { Counterpart, Person } from "@/types/schema";
import { peopleORPCClient, toPeopleApiError } from "./orpc";

export interface CounterpartWithExtras extends Counterpart {
  institution?: { name: string };
}

export interface PeopleListResponse {
  people: PersonWithExtras[];
  status: string;
}

export interface PersonDetailResponse {
  person: PersonWithExtras;
}

export interface PersonWithExtras extends Person {
  birthDate?: string;
  counterpart?: CounterpartWithExtras | null;
  gender?: string;
  hasEmployee?: boolean;
  hasUser?: boolean;
}

/**
 * Counterpart schema with .passthrough() to allow extra database fields.
 * Safe because: only defined fields are accessed in code, extra fields are simply ignored.
 * This pattern handles database columns that may or may not be populated (e.g., institution relation).
 * @see {@link https://v3.zod.dev/ Zod discriminated unions and passthrough patterns}
 */
const CounterpartWithExtrasSchema = z
  .object({
    id: z.number(),
    institution: z
      .object({
        name: z.string(),
      })
      .optional(),
  })
  .passthrough();

/**
 * Person schema with .passthrough() to accommodate:
 * 1. Optional relations (employee, user, counterpart) that may or may not be populated
 * 2. Extra database columns from joins or computed fields
 *
 * Type safety maintained through boundary validation:
 * - After schema.parse(), only defined fields are typed
 * - Extra fields ignored (cannot access undefined properties)
 * - Frontend cast to PersonWithExtras ensures type alignment
 *
 * @see {@link ./types.ts PersonWithExtras interface}
 * @see {@link ../../docs/PRAGMATIC_TYPING_GUIDE.md Zod passthrough patterns}
 */
const PersonWithExtrasSchema = z
  .object({
    birthDate: z.string().optional(),
    counterpart: CounterpartWithExtrasSchema.nullable().optional(),
    createdAt: z.coerce.date(),
    email: z.string().nullable(),
    employee: z.unknown().nullable().optional(),
    fatherName: z.string().nullable(),
    gender: z.string().nullable().optional(),
    hasEmployee: z.boolean().optional(),
    hasUser: z.boolean().optional(),
    id: z.number(),
    motherName: z.string().nullable(),
    names: z.string(),
    personType: z.enum(["JURIDICAL", "NATURAL"]),
    rut: z.string(),
    updatedAt: z.coerce.date(),
    user: z.unknown().nullable().optional(),
  })
  .passthrough();

const PeopleListResponseSchema = z.object({
  people: z.array(PersonWithExtrasSchema),
  status: z.literal("ok"),
});

const PersonDetailResponseSchema = z.object({
  person: PersonWithExtrasSchema,
});

export async function fetchPeople(): Promise<PersonWithExtras[]> {
  try {
    const res = PeopleListResponseSchema.parse(await peopleORPCClient.list());
    return res.people as PersonWithExtras[];
  } catch (error) {
    throw toPeopleApiError(error);
  }
}

export async function fetchPerson(id: number | string): Promise<PersonWithExtras> {
  try {
    const res = PersonDetailResponseSchema.parse(await peopleORPCClient.detail({ id: Number(id) }));
    return res.person as PersonWithExtras;
  } catch (error) {
    throw toPeopleApiError(error);
  }
}

// ============================================================================
// Query Keys
// ============================================================================

export const peopleKeys = {
  all: ["people"] as const,
  detail: (id: number | string) => [...peopleKeys.details(), id] as const,
  details: () => [...peopleKeys.all, "detail"] as const,
  list: () => [...peopleKeys.lists()] as const,
  lists: () => [...peopleKeys.all, "list"] as const,
};

// ============================================================================
// Query Options
// ============================================================================

export const peopleQueries = {
  detail: (id: number | string) =>
    queryOptions({
      queryFn: () => fetchPerson(id),
      queryKey: peopleKeys.detail(id),
      staleTime: 5 * 60 * 1000,
    }),
  list: () =>
    queryOptions({
      queryFn: fetchPeople,
      queryKey: peopleKeys.list(),
      staleTime: 5 * 60 * 1000, // 5 minutes
    }),
};
