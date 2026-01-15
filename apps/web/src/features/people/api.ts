import { queryOptions } from "@tanstack/react-query";

import { apiClient } from "@/lib/apiClient";
import type { Counterpart, Person } from "@/types/schema";

export interface CounterpartWithExtras extends Counterpart {
  institution?: { name: string };
}

export interface PersonWithExtras extends Person {
  gender?: string;
  birthDate?: string;
  hasUser?: boolean;
  hasEmployee?: boolean;
  counterpart?: CounterpartWithExtras | null;
}

export interface PeopleListResponse {
  status: string;
  people: PersonWithExtras[];
}

export interface PersonDetailResponse {
  person: PersonWithExtras;
}

export async function fetchPeople(): Promise<PersonWithExtras[]> {
  const res = await apiClient.get<PeopleListResponse>("/api/people");
  return res.people;
}

export async function fetchPerson(id: number | string): Promise<PersonWithExtras> {
  const res = await apiClient.get<PersonDetailResponse>(`/api/people/${id}`);
  return res.person;
}

// ============================================================================
// Query Keys
// ============================================================================

export const peopleKeys = {
  all: ["people"] as const,
  lists: () => [...peopleKeys.all, "list"] as const,
  list: () => [...peopleKeys.lists()] as const,
  details: () => [...peopleKeys.all, "detail"] as const,
  detail: (id: number | string) => [...peopleKeys.details(), id] as const,
};

// ============================================================================
// Query Options
// ============================================================================

export const peopleQueries = {
  list: () =>
    queryOptions({
      queryKey: peopleKeys.list(),
      queryFn: fetchPeople,
      staleTime: 5 * 60 * 1000, // 5 minutes
    }),
  detail: (id: number | string) =>
    queryOptions({
      queryKey: peopleKeys.detail(id),
      queryFn: () => fetchPerson(id),
      staleTime: 5 * 60 * 1000,
    }),
};
