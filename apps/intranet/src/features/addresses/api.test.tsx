/**
 * Tests for `@/features/addresses/api` — oRPC wrapper + contract guard.
 *
 * Focus:
 * - `listAddresses` runs the response through the shared
 *   `addressListResultSchema`; malformed rows throw an `ApiError(500)`
 *   with a precise field-path message (defence against legacy DB rows
 *   that slip past the server contract).
 * - mutation wrappers (`create`, `update`, `delete`, `setPrimary`)
 *   forward the payload unchanged and unwrap `{ address }` envelopes.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api-client";

const orpc = vi.hoisted(() => ({
  list: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  setPrimary: vi.fn(),
}));

vi.mock("./orpc", () => ({
  addressesORPCClient: orpc,
  toAddressesApiError: (e: unknown) => {
    if (e instanceof ApiError) return e;
    if (e instanceof Error) return new ApiError(e.message, 500);
    return new ApiError("unexpected", 500, e);
  },
}));

const { createAddress, deleteAddress, listAddresses, setPrimaryAddress, updateAddress } =
  await import("./api");

const baseAddress = {
  id: 1,
  personId: 10,
  label: "Casa",
  street: "Av. Apoquindo",
  number: "5500",
  supplement: null,
  reference: null,
  postalCode: "7550000",
  comuna: "Las Condes",
  region: "Metropolitana",
  coverageCode: "LCONDES",
  regionCode: "13",
  ineRegionCode: 13,
  ineCountyCode: 13114,
  supportsCashOnDelivery: true,
  supportsReturn: true,
  latitude: null,
  longitude: null,
  chilexpressAddressId: null,
  countryCode: "CL",
  isPrimary: true,
  isActive: true,
  createdAt: new Date("2026-01-01").toISOString(),
  updatedAt: new Date("2026-01-01").toISOString(),
};

describe("addresses/api", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("listAddresses", () => {
    it("returns the parsed addresses for a person", async () => {
      orpc.list.mockResolvedValue({ addresses: [baseAddress] });
      const result = await listAddresses(10);
      expect(orpc.list).toHaveBeenCalledWith({ personId: 10 });
      expect(result).toHaveLength(1);
      expect(result[0]?.label).toBe("Casa");
    });

    it("throws a precise ApiError(500) when a row fails contract validation", async () => {
      orpc.list.mockResolvedValue({ addresses: [{ id: "not-a-number" }] });
      await expect(listAddresses(10)).rejects.toMatchObject({
        name: "ApiError",
        status: 500,
        message: expect.stringContaining("no cumple el contrato"),
      });
    });

    it("wraps oRPC client failures via toAddressesApiError", async () => {
      orpc.list.mockRejectedValue(new Error("offline"));
      await expect(listAddresses(10)).rejects.toMatchObject({
        name: "ApiError",
        message: "offline",
      });
    });
  });

  describe("createAddress / updateAddress", () => {
    it("unwraps { address } from create()", async () => {
      orpc.create.mockResolvedValue({ address: baseAddress });
      const result = await createAddress({
        personId: 10,
        label: "Casa",
        street: "Av. X",
        number: "1",
        comuna: "Providencia",
        region: "Metropolitana",
        regionCode: "13",
        coverageCode: "PROV",
      } as Parameters<typeof createAddress>[0]);
      expect(result).toEqual(baseAddress);
    });

    it("unwraps { address } from update()", async () => {
      orpc.update.mockResolvedValue({ address: baseAddress });
      const result = await updateAddress({
        id: 1,
        payload: { label: "Trabajo" },
      } as Parameters<typeof updateAddress>[0]);
      expect(result).toEqual(baseAddress);
      expect(orpc.update).toHaveBeenCalledWith({ id: 1, payload: { label: "Trabajo" } });
    });
  });

  describe("deleteAddress", () => {
    it("forwards the id and returns undefined", async () => {
      orpc.delete.mockResolvedValue(undefined);
      await expect(deleteAddress(7)).resolves.toBeUndefined();
      expect(orpc.delete).toHaveBeenCalledWith({ id: 7 });
    });

    it("propagates errors as ApiError", async () => {
      orpc.delete.mockRejectedValue(new Error("forbidden"));
      await expect(deleteAddress(7)).rejects.toBeInstanceOf(ApiError);
    });
  });

  describe("setPrimaryAddress", () => {
    it("forwards id + personId and unwraps the response", async () => {
      orpc.setPrimary.mockResolvedValue({ address: { ...baseAddress, isPrimary: true } });
      const result = await setPrimaryAddress(7, 10);
      expect(orpc.setPrimary).toHaveBeenCalledWith({ id: 7, personId: 10 });
      expect(result.isPrimary).toBe(true);
    });
  });
});
