/**
 * Tests for `@/features/people/api` — thin oRPC wrappers + zod validation.
 *
 * Golden 2026: mock the module boundary (`./orpc`), assert that
 *   1. happy paths return the parsed/typed shape;
 *   2. malformed server payloads surface via `toPeopleApiError`;
 *   3. RUTs are passed verbatim (no client-side normalisation here).
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api-client";

const orpc = vi.hoisted(() => ({
  list: vi.fn(),
  detail: vi.fn(),
  findByRut: vi.fn(),
}));

vi.mock("./orpc", () => ({
  peopleORPCClient: orpc,
  toPeopleApiError: (e: unknown) => {
    if (e instanceof ApiError) return e;
    if (e instanceof Error) return new ApiError(e.message, 500);
    return new ApiError("unexpected", 500, e);
  },
}));

const { fetchPeople, fetchPerson, findPersonByRut, peopleKeys, peopleQueries } =
  await import("./api");

// Valid Chilean RUTs (algorithmically correct check digits).
const VALID_RUT_K = "12345670-K";
const VALID_RUT_2 = "13579089-7";

function makePerson(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    rut: VALID_RUT_K,
    names: "Ana Pérez",
    fatherName: "Pérez",
    motherName: "Soto",
    email: "ana@example.com",
    personType: "NATURAL" as const,
    createdAt: new Date("2026-01-01").toISOString(),
    updatedAt: new Date("2026-01-02").toISOString(),
    ...overrides,
  };
}

describe("people/api", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("fetchPeople", () => {
    it("returns the people array on a well-formed response", async () => {
      orpc.list.mockResolvedValue({ status: "ok", people: [makePerson()] });
      const result = await fetchPeople();
      expect(result).toHaveLength(1);
      expect(result[0]?.rut).toBe(VALID_RUT_K);
    });

    it("throws ApiError when the response shape is invalid", async () => {
      orpc.list.mockResolvedValue({ status: "ok", people: [{ id: "not-a-number" }] });
      await expect(fetchPeople()).rejects.toBeInstanceOf(ApiError);
    });

    it("propagates oRPC client failures via toPeopleApiError", async () => {
      orpc.list.mockRejectedValue(new Error("network down"));
      await expect(fetchPeople()).rejects.toMatchObject({
        name: "ApiError",
        message: "network down",
      });
    });
  });

  describe("fetchPerson", () => {
    it("calls detail with a numeric id even when given a string", async () => {
      orpc.detail.mockResolvedValue({ person: makePerson({ id: 42 }) });
      await fetchPerson("42");
      expect(orpc.detail).toHaveBeenCalledWith({ id: 42 });
    });

    it("returns the parsed person", async () => {
      orpc.detail.mockResolvedValue({ person: makePerson({ id: 7 }) });
      const result = await fetchPerson(7);
      expect(result.id).toBe(7);
    });
  });

  describe("findPersonByRut", () => {
    it("returns the matched person", async () => {
      orpc.findByRut.mockResolvedValue({ person: makePerson({ rut: VALID_RUT_2 }) });
      const found = await findPersonByRut(VALID_RUT_2);
      expect(found?.rut).toBe(VALID_RUT_2);
    });

    it("returns null when no person matches", async () => {
      orpc.findByRut.mockResolvedValue({ person: null });
      const found = await findPersonByRut("99999999-9");
      expect(found).toBeNull();
    });

    it("forwards the RUT verbatim to the oRPC client", async () => {
      orpc.findByRut.mockResolvedValue({ person: null });
      await findPersonByRut(VALID_RUT_K);
      expect(orpc.findByRut).toHaveBeenCalledWith({ rut: VALID_RUT_K });
    });
  });

  describe("peopleKeys / peopleQueries", () => {
    it("exposes stable cache keys for list and detail", () => {
      expect(peopleKeys.list()).toEqual(["people", "list"]);
      expect(peopleKeys.detail(1)).toEqual(["people", "detail", 1]);
    });

    it("queryOptions for detail wire the right queryKey", () => {
      const opts = peopleQueries.detail(5);
      expect(opts.queryKey).toEqual(["people", "detail", 5]);
    });
  });
});
