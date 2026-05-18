/**
 * Tests for `CatalogPage` — product list table, create/edit modal, and
 * archive flow.
 *
 * Mocks at module boundaries only: `../api` (orpc CRUD wrappers),
 * `@/context/AuthContext` (can() permission gate), `@/context/ToastContext`,
 * `@/components/ui/ConfirmDialog` (confirmAction), and `../components/*`
 * (form/uploader are tested in isolation).
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { Suspense } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const apiMocks = vi.hoisted(() => ({
  getProducts: vi.fn(),
  getProductById: vi.fn(),
  getCategories: vi.fn(),
  createProduct: vi.fn(),
  updateProduct: vi.fn(),
  archiveProduct: vi.fn(),
  createCategory: vi.fn(),
  deleteCategory: vi.fn(),
}));

const toastMocks = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
}));

const confirmActionMock = vi.hoisted(() => vi.fn<() => Promise<boolean>>());

const authMock = vi.hoisted(() => ({
  can: vi.fn(() => true),
}));

vi.mock("../api", () => apiMocks);

vi.mock("@/context/AuthContext", () => ({
  useAuth: () => authMock,
}));

vi.mock("@/context/ToastContext", () => ({
  useToast: () => toastMocks,
}));

vi.mock("@/components/ui/ConfirmDialog", () => ({
  confirmAction: confirmActionMock,
}));

// Stub heavy child components: tested separately.
vi.mock("../components/ProductForm", () => ({
  ProductForm: ({
    onSave,
    onCancel,
    saving,
  }: {
    onSave: (v: unknown) => void;
    onCancel: () => void;
    saving: boolean;
  }) => (
    <div data-testid="product-form">
      <button
        type="button"
        onClick={() =>
          onSave({
            name: "Nuevo",
            sku: "NEW-1",
            slug: "nuevo",
            short_description: "",
            description: "",
            category_id: null,
            brand: "",
            price_clp: 100,
            compare_at_price_clp: null,
            cost_clp: null,
            weight_grams: null,
            barcode: "",
            requires_prescription: false,
            status: "DRAFT",
            seo_title: "",
            seo_description: "",
            available_qty: 1,
            safety_stock: 0,
          })
        }
      >
        stub-save
      </button>
      <button type="button" onClick={onCancel}>
        stub-cancel
      </button>
      <span data-testid="stub-saving">{String(saving)}</span>
    </div>
  ),
}));

vi.mock("../components/ImageUploader", () => ({
  ImageUploader: () => <div data-testid="image-uploader" />,
}));

const { CatalogPage } = await import("./CatalogPage");

function buildWrapper() {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>
      <Suspense fallback={<div data-testid="suspense-fallback">loading</div>}>{children}</Suspense>
    </QueryClientProvider>
  );
}

function makeProduct(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 1,
    sku: "SKU-1",
    name: "Producto Uno",
    brand: "BrandA",
    short_description: null,
    description: null,
    category_id: null,
    slug: "producto-uno",
    price_clp: 9990,
    compare_at_price_clp: null,
    cost_clp: null,
    weight_grams: null,
    barcode: null,
    requires_prescription: false,
    status: "ACTIVE",
    seo_title: null,
    seo_description: null,
    available_qty: 10,
    safety_stock: 2,
    images: [],
    ...overrides,
  };
}

describe("CatalogPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.can = vi.fn(() => true);
  });

  it("renders product list with desktop table after suspense", async () => {
    apiMocks.getProducts.mockResolvedValue({
      data: [makeProduct(), makeProduct({ id: 2, sku: "SKU-2", name: "Otro" })],
    });
    const Wrapper = buildWrapper();
    render(
      <Wrapper>
        <CatalogPage />
      </Wrapper>
    );

    // Both desktop table and mobile card list render concurrently (CSS toggles visibility).
    expect((await screen.findAllByText("Producto Uno")).length).toBeGreaterThan(0);
    expect(screen.getAllByText("Otro").length).toBeGreaterThan(0);
    // Card.Description text reflects count.
    expect(screen.getByText(/2 productos cargados/i)).toBeInTheDocument();
  });

  it("renders empty state copy when list is empty", async () => {
    apiMocks.getProducts.mockResolvedValue({ data: [] });
    const Wrapper = buildWrapper();
    render(
      <Wrapper>
        <CatalogPage />
      </Wrapper>
    );

    expect((await screen.findAllByText(/Sin productos/)).length).toBeGreaterThan(0);
  });

  it("'Agregar producto' button is disabled when create permission is denied", async () => {
    apiMocks.getProducts.mockResolvedValue({ data: [] });
    authMock.can = vi.fn(() => false);
    const Wrapper = buildWrapper();
    render(
      <Wrapper>
        <CatalogPage />
      </Wrapper>
    );

    const btn = await screen.findByRole("button", { name: /Agregar producto/i });
    expect(btn).toBeDisabled();
  });

  it("opens create modal and triggers createProduct on save", async () => {
    const user = userEvent.setup();
    apiMocks.getProducts.mockResolvedValue({ data: [] });
    apiMocks.createProduct.mockResolvedValue({ data: { id: 99 } });
    const Wrapper = buildWrapper();
    render(
      <Wrapper>
        <CatalogPage />
      </Wrapper>
    );

    const add = await screen.findByRole("button", { name: /Agregar producto/i });
    await user.click(add);

    const save = await screen.findByText("stub-save");
    await user.click(save);

    await waitFor(() => expect(apiMocks.createProduct).toHaveBeenCalled());
    await waitFor(() => expect(toastMocks.success).toHaveBeenCalledWith("Producto creado"));
  });

  it("save error surfaces in Alert and toastError", async () => {
    const user = userEvent.setup();
    apiMocks.getProducts.mockResolvedValue({ data: [] });
    apiMocks.createProduct.mockRejectedValue(new Error("SKU duplicado"));
    const Wrapper = buildWrapper();
    render(
      <Wrapper>
        <CatalogPage />
      </Wrapper>
    );

    await user.click(await screen.findByRole("button", { name: /Agregar producto/i }));
    await user.click(await screen.findByText("stub-save"));

    await waitFor(() => expect(toastMocks.error).toHaveBeenCalledWith("SKU duplicado"));
    expect(await screen.findByText("SKU duplicado")).toBeInTheDocument();
  });

  it("archive: confirmAction cancel → archive not called", async () => {
    const user = userEvent.setup();
    apiMocks.getProducts.mockResolvedValue({ data: [makeProduct()] });
    confirmActionMock.mockResolvedValue(false);
    const Wrapper = buildWrapper();
    render(
      <Wrapper>
        <CatalogPage />
      </Wrapper>
    );

    await screen.findByText("Producto Uno");
    const buttons = screen.getAllByRole("button");
    // Find archive icon buttons (lucide-archive).
    const archiveBtn = buttons.find((b) => b.querySelector("svg.lucide-archive"));
    expect(archiveBtn).toBeDefined();
    await user.click(archiveBtn!);

    await waitFor(() => expect(confirmActionMock).toHaveBeenCalled());
    expect(apiMocks.archiveProduct).not.toHaveBeenCalled();
  });

  it("archive: confirm → archiveProduct called → toastSuccess", async () => {
    const user = userEvent.setup();
    apiMocks.getProducts.mockResolvedValue({ data: [makeProduct()] });
    confirmActionMock.mockResolvedValue(true);
    apiMocks.archiveProduct.mockResolvedValue({ data: { ok: true } });
    const Wrapper = buildWrapper();
    render(
      <Wrapper>
        <CatalogPage />
      </Wrapper>
    );

    await screen.findByText("Producto Uno");
    const buttons = screen.getAllByRole("button");
    const archiveBtn = buttons.find((b) => b.querySelector("svg.lucide-archive"));
    await user.click(archiveBtn!);

    await waitFor(() => expect(apiMocks.archiveProduct).toHaveBeenCalledWith(1));
    await waitFor(() => expect(toastMocks.success).toHaveBeenCalledWith("Producto archivado"));
  });

  it("edit button opens modal with editing context (ImageUploader rendered)", async () => {
    const user = userEvent.setup();
    apiMocks.getProducts.mockResolvedValue({ data: [makeProduct()] });
    const Wrapper = buildWrapper();
    render(
      <Wrapper>
        <CatalogPage />
      </Wrapper>
    );

    await screen.findByText("Producto Uno");
    // Edit3 icon ships as lucide-pen-line (lucide v0.5+ renamed it).
    const editBtn = screen
      .getAllByRole("button")
      .find((b) => b.innerHTML.includes("lucide-pen-line"));
    expect(editBtn).toBeDefined();
    await user.click(editBtn!);

    expect(await screen.findByTestId("image-uploader")).toBeInTheDocument();
  });
});
