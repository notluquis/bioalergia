import { queryOptions } from "@tanstack/react-query";

import type { Counterpart, Person } from "@/types/schema";

import { apiClient } from "@/lib/apiClient";

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
