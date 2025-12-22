import { apiClient } from "@/lib/apiClient";
import type { Person, Counterpart } from "@/types/schema";

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
