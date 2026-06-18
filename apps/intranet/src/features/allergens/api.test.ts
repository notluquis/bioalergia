/**
 * Tests for `apps/intranet/src/features/allergens/api.ts`.
 *
 * Golden 2026 patterns (mirrors features/roles/api.test.ts):
 * - `vi.hoisted` for the mocked oRPC client (factory hoisting safe).
 * - Mock the module boundary (`./orpc`) — never reach into ApiError /
 *   ORPCError internals.
 * - Cover success + error path for every exported wrapper.
 * - The wrappers don't re-validate the response (no Zod parse), so the
 *   only failure surface is the oRPC call rejecting → routed through
 *   `toAllergensApiError` → `ApiError`.
 */

import { describe, expect, it, vi, beforeEach } from "vitest";
import type * as OrpcModule from "./orpc";
import { ApiError } from "@/lib/api-client";

const orpcMock = vi.hoisted(() => ({
  clinicalAllergensORPCClient: {
    listAllergens: vi.fn(),
    getAllergen: vi.fn(),
    createAllergen: vi.fn(),
    updateAllergen: vi.fn(),
    deactivateAllergen: vi.fn(),
  },
}));

vi.mock("./orpc", async (importOriginal) => {
  const actual = await importOriginal<typeof OrpcModule>();
  return {
    ...actual,
    clinicalAllergensORPCClient: orpcMock.clinicalAllergensORPCClient,
  };
});

const api = await import("./api");

const fixtureAllergen = {
  id: "alg_0001",
  scientificName: "Cynodon dactylon",
  commonName: "Pasto bermuda",
  englishName: "Bermuda grass",
  category: "Gramínea",
  categoryEn: "Grass",
  pollenType: "Polen de pastos",
  pollenTypeEn: "Grass pollen",
  tags: ["estacional"],
  isActive: true,
  aliases: [{ id: "ali_1", alias: "bermuda", aliasType: "MANUAL" }],
};

beforeEach(() => {
  for (const fn of Object.values(orpcMock.clinicalAllergensORPCClient)) {
    fn.mockReset();
  }
});

describe("listAllergens", () => {
  it("returns the allergens array (unwrapped)", async () => {
    orpcMock.clinicalAllergensORPCClient.listAllergens.mockResolvedValueOnce({
      allergens: [fixtureAllergen],
    });
    await expect(api.listAllergens({ q: "pasto" })).resolves.toEqual([fixtureAllergen]);
    expect(orpcMock.clinicalAllergensORPCClient.listAllergens).toHaveBeenCalledWith({ q: "pasto" });
  });

  it("defaults to empty options when called without args", async () => {
    orpcMock.clinicalAllergensORPCClient.listAllergens.mockResolvedValueOnce({ allergens: [] });
    await expect(api.listAllergens()).resolves.toEqual([]);
    expect(orpcMock.clinicalAllergensORPCClient.listAllergens).toHaveBeenCalledWith({});
  });

  it("wraps oRPC errors as ApiError", async () => {
    orpcMock.clinicalAllergensORPCClient.listAllergens.mockRejectedValueOnce(new Error("network"));
    await expect(api.listAllergens()).rejects.toBeInstanceOf(ApiError);
  });
});

describe("getAllergen", () => {
  it("forwards the id and returns the allergen", async () => {
    orpcMock.clinicalAllergensORPCClient.getAllergen.mockResolvedValueOnce({
      allergen: fixtureAllergen,
    });
    await expect(api.getAllergen("alg_0001")).resolves.toEqual(fixtureAllergen);
    expect(orpcMock.clinicalAllergensORPCClient.getAllergen).toHaveBeenCalledWith({
      id: "alg_0001",
    });
  });

  it("wraps errors", async () => {
    orpcMock.clinicalAllergensORPCClient.getAllergen.mockRejectedValueOnce(new Error("boom"));
    await expect(api.getAllergen("x")).rejects.toBeInstanceOf(ApiError);
  });
});

describe("createAllergen", () => {
  it("forwards the payload and returns the created allergen", async () => {
    orpcMock.clinicalAllergensORPCClient.createAllergen.mockResolvedValueOnce({
      allergen: fixtureAllergen,
    });
    const input = { commonName: "Pasto bermuda", category: "Gramínea", tags: [], isActive: true };
    await expect(api.createAllergen(input)).resolves.toEqual(fixtureAllergen);
    expect(orpcMock.clinicalAllergensORPCClient.createAllergen).toHaveBeenCalledWith(input);
  });

  it("wraps errors", async () => {
    orpcMock.clinicalAllergensORPCClient.createAllergen.mockRejectedValueOnce(new Error("x"));
    await expect(
      api.createAllergen({ commonName: "X", category: "C", tags: [], isActive: true })
    ).rejects.toBeInstanceOf(ApiError);
  });
});

describe("updateAllergen", () => {
  it("forwards id + payload and returns the updated allergen", async () => {
    orpcMock.clinicalAllergensORPCClient.updateAllergen.mockResolvedValueOnce({
      allergen: fixtureAllergen,
    });
    const input = { id: "alg_0001", commonName: "Pasto bermuda" };
    await expect(api.updateAllergen(input)).resolves.toEqual(fixtureAllergen);
    expect(orpcMock.clinicalAllergensORPCClient.updateAllergen).toHaveBeenCalledWith(input);
  });

  it("wraps errors", async () => {
    orpcMock.clinicalAllergensORPCClient.updateAllergen.mockRejectedValueOnce(new Error("x"));
    await expect(api.updateAllergen({ id: "alg_0001" })).rejects.toBeInstanceOf(ApiError);
  });
});

describe("deactivateAllergen", () => {
  it("forwards the id and returns the deactivated allergen", async () => {
    orpcMock.clinicalAllergensORPCClient.deactivateAllergen.mockResolvedValueOnce({
      allergen: { ...fixtureAllergen, isActive: false },
    });
    await expect(api.deactivateAllergen("alg_0001")).resolves.toEqual({
      ...fixtureAllergen,
      isActive: false,
    });
    expect(orpcMock.clinicalAllergensORPCClient.deactivateAllergen).toHaveBeenCalledWith({
      id: "alg_0001",
    });
  });

  it("wraps errors", async () => {
    orpcMock.clinicalAllergensORPCClient.deactivateAllergen.mockRejectedValueOnce(new Error("x"));
    await expect(api.deactivateAllergen("x")).rejects.toBeInstanceOf(ApiError);
  });
});
