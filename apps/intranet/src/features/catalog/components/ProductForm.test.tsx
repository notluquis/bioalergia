/**
 * Tests for `ProductForm` — Zod-equivalent inline validation +
 * controlled state for the catalog product editor.
 *
 * Golden 2026 patterns: QueryClient per test, mock the api boundary
 * (`./queries` consumers via `../api`), use `findBy*` for async-rendered
 * content, exercise validation through real user interactions.
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const apiMocks = vi.hoisted(() => ({
  getProducts: vi.fn(),
  getProductById: vi.fn(),
  getCategories: vi.fn(),
}));

vi.mock("../api", () => apiMocks);

const { ProductForm } = await import("./ProductForm");
type FormValues = Parameters<NonNullable<Parameters<typeof ProductForm>[0]["onSave"]>>[0];

function buildWrapper() {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

describe("ProductForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiMocks.getCategories.mockResolvedValue({ data: [] });
  });

  it("renders all required fields with their labels", async () => {
    const Wrapper = buildWrapper();
    render(
      <Wrapper>
        <ProductForm
          initial={null}
          onCancel={() => undefined}
          onSave={() => undefined}
          saving={false}
        />
      </Wrapper>
    );

    expect(await screen.findByLabelText(/^Nombre$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^SKU$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Slug \(URL\)/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Precio CLP/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Stock disponible/i)).toBeInTheDocument();
  });

  it("autogenerates slug from name on blur (when slug empty)", async () => {
    const user = userEvent.setup();
    const Wrapper = buildWrapper();
    render(
      <Wrapper>
        <ProductForm
          initial={null}
          onCancel={() => undefined}
          onSave={() => undefined}
          saving={false}
        />
      </Wrapper>
    );

    const name = await screen.findByLabelText(/^Nombre$/i);
    await user.type(name, "ISDIN Baby Naturals 400ml");
    await user.tab();

    const slug = screen.getByLabelText(/Slug \(URL\)/i) as HTMLInputElement;
    await waitFor(() => expect(slug.value).toBe("isdin-baby-naturals-400ml"));
  });

  it("hydrates form from `initial` prop", async () => {
    const Wrapper = buildWrapper();
    render(
      <Wrapper>
        <ProductForm
          initial={{ name: "Existing", sku: "EX-1", slug: "existing", price_clp: 9990 }}
          onCancel={() => undefined}
          onSave={() => undefined}
          saving={false}
        />
      </Wrapper>
    );

    expect(await screen.findByDisplayValue("Existing")).toBeInTheDocument();
    expect(screen.getByDisplayValue("EX-1")).toBeInTheDocument();
    expect(screen.getByDisplayValue("9990")).toBeInTheDocument();
  });

  it("calls onSave with full values on submit (happy path)", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    const Wrapper = buildWrapper();
    render(
      <Wrapper>
        <ProductForm
          initial={{ name: "Crema", sku: "C-1", slug: "crema", price_clp: 100, available_qty: 5 }}
          onCancel={() => undefined}
          onSave={onSave}
          saving={false}
        />
      </Wrapper>
    );

    const submit = await screen.findByRole("button", { name: /Guardar producto/i });
    await user.click(submit);

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    const values = onSave.mock.calls[0]?.[0] as FormValues;
    expect(values.name).toBe("Crema");
    expect(values.sku).toBe("C-1");
    expect(values.price_clp).toBe(100);
    expect(values.status).toBe("DRAFT");
  });

  it("disables Guardar button while saving and shows 'Guardando...'", async () => {
    const Wrapper = buildWrapper();
    render(
      <Wrapper>
        <ProductForm initial={null} onCancel={() => undefined} onSave={() => undefined} saving />
      </Wrapper>
    );

    const submit = await screen.findByRole("button", { name: /Guardando/i });
    expect(submit).toBeDisabled();
  });

  it("Cancelar invokes onCancel", async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    const Wrapper = buildWrapper();
    render(
      <Wrapper>
        <ProductForm initial={null} onCancel={onCancel} onSave={() => undefined} saving={false} />
      </Wrapper>
    );

    const cancel = await screen.findByRole("button", { name: /Cancelar/i });
    await user.click(cancel);
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
