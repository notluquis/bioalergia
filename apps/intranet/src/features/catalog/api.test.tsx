/**
 * Tests for catalog `api.ts` orpc wrappers.
 *
 * Golden 2026 patterns: `vi.hoisted` shared mock factory, module-boundary
 * mocking only (the orpc client), error-mapping coverage via
 * `toCatalogApiError` (re-thrown as ApiError).
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const orpcMocks = vi.hoisted(() => ({
  list: vi.fn(),
  getById: vi.fn(),
  listCategories: vi.fn(),
  adminCreate: vi.fn(),
  adminUpdate: vi.fn(),
  adminArchive: vi.fn(),
  createCategory: vi.fn(),
  deleteCategory: vi.fn(),
}));

vi.mock("./orpc", async () => {
  const actual = await vi.importActual<typeof import("./orpc")>("./orpc");
  return {
    catalogORPCClient: orpcMocks,
    toCatalogApiError: actual.toCatalogApiError,
  };
});

const {
  archiveProduct,
  createCategory,
  createProduct,
  deleteCategory,
  getCategories,
  getProductById,
  getProducts,
  updateProduct,
} = await import("./api");
const { ApiError } = await import("@/lib/api-client");

describe("catalog/api", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getProducts", () => {
    it("forwards opts with defaults (limit=50, includeInactive renamed to include_inactive)", async () => {
      orpcMocks.list.mockResolvedValue({ data: [] });
      await getProducts({ includeInactive: true, q: "isdin" });
      expect(orpcMocks.list).toHaveBeenCalledWith({
        limit: 50,
        cursor: undefined,
        q: "isdin",
        include_inactive: true,
      });
    });

    it("uses defaults when called with no opts", async () => {
      orpcMocks.list.mockResolvedValue({ data: [] });
      await getProducts();
      expect(orpcMocks.list).toHaveBeenCalledWith({
        limit: 50,
        cursor: undefined,
        q: undefined,
        include_inactive: undefined,
      });
    });

    it("wraps thrown errors as ApiError", async () => {
      orpcMocks.list.mockRejectedValue(new Error("network down"));
      await expect(getProducts()).rejects.toBeInstanceOf(ApiError);
    });
  });

  describe("getProductById", () => {
    it("calls getById with id", async () => {
      orpcMocks.getById.mockResolvedValue({ data: { id: 1 } });
      await getProductById(1);
      expect(orpcMocks.getById).toHaveBeenCalledWith({ id: 1 });
    });

    it("wraps errors", async () => {
      orpcMocks.getById.mockRejectedValue(new Error("not found"));
      await expect(getProductById(99)).rejects.toBeInstanceOf(ApiError);
    });
  });

  describe("getCategories", () => {
    it("calls listCategories with no args", async () => {
      orpcMocks.listCategories.mockResolvedValue({ data: [] });
      await getCategories();
      expect(orpcMocks.listCategories).toHaveBeenCalledWith();
    });
  });

  describe("createProduct / updateProduct / archiveProduct", () => {
    it("createProduct forwards input", async () => {
      orpcMocks.adminCreate.mockResolvedValue({ data: { id: 1 } });
      const input = { name: "x", sku: "y" } as never;
      await createProduct(input);
      expect(orpcMocks.adminCreate).toHaveBeenCalledWith(input);
    });

    it("updateProduct shapes payload as { id, product }", async () => {
      orpcMocks.adminUpdate.mockResolvedValue({ data: { id: 7 } });
      const product = { name: "nuevo" } as never;
      await updateProduct(7, product);
      expect(orpcMocks.adminUpdate).toHaveBeenCalledWith({ id: 7, product });
    });

    it("archiveProduct passes { id }", async () => {
      orpcMocks.adminArchive.mockResolvedValue({ data: { ok: true } });
      await archiveProduct(42);
      expect(orpcMocks.adminArchive).toHaveBeenCalledWith({ id: 42 });
    });

    it("wraps create errors as ApiError", async () => {
      orpcMocks.adminCreate.mockRejectedValue(new Error("boom"));
      await expect(createProduct({} as never)).rejects.toBeInstanceOf(ApiError);
    });
  });

  describe("createCategory / deleteCategory", () => {
    it("createCategory forwards input", async () => {
      orpcMocks.createCategory.mockResolvedValue({ data: { id: 1 } });
      const input = { name: "Cuidado piel" } as never;
      await createCategory(input);
      expect(orpcMocks.createCategory).toHaveBeenCalledWith(input);
    });

    it("deleteCategory passes { id }", async () => {
      orpcMocks.deleteCategory.mockResolvedValue({ data: { ok: true } });
      await deleteCategory(3);
      expect(orpcMocks.deleteCategory).toHaveBeenCalledWith({ id: 3 });
    });

    it("wraps delete errors", async () => {
      orpcMocks.deleteCategory.mockRejectedValue(new Error("FK violation"));
      await expect(deleteCategory(3)).rejects.toBeInstanceOf(ApiError);
    });
  });
});
