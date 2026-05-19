import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Suspense } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { inventoryKeys } from "@/features/inventory/queries";
import type { AllergyInventoryOverview, InventoryItem } from "@/features/inventory/types";

const canMock = vi.hoisted(() => vi.fn<(action: string, subject: string) => boolean>(() => true));
const toastSuccessMock = vi.hoisted(() => vi.fn<(message: string) => void>());
const toastErrorMock = vi.hoisted(() => vi.fn<(message: unknown) => void>());

vi.mock("@/context/AuthContext", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/context/AuthContext")>();
  return {
    ...actual,
    useAuth: () => ({ can: canMock }),
  };
});

vi.mock("@/context/ToastContext", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/context/ToastContext")>();
  return {
    ...actual,
    useToast: () => ({
      error: toastErrorMock,
      success: toastSuccessMock,
      info: vi.fn(),
    }),
  };
});

vi.mock("@/features/inventory/api", () => ({
  createInventoryCategory: vi.fn(() => Promise.resolve({ id: 1, name: "Mock" })),
  createInventoryItem: vi.fn(() => Promise.resolve()),
  createInventoryMovement: vi.fn(() => Promise.resolve()),
  fetchAllergyOverview: vi.fn(() => Promise.resolve([])),
  getInventoryCategories: vi.fn(() => Promise.resolve([])),
  getInventoryItems: vi.fn(() => Promise.resolve([])),
  updateInventoryItem: vi.fn(() => Promise.resolve()),
}));

import { InventoryPage } from "./InventoryPage";

const mockItems: InventoryItem[] = [
  {
    id: 1,
    name: "Lancetas estériles",
    category_id: 1,
    category_name: "Material clínico",
    current_stock: 42,
    description: "Caja x100",
  },
  {
    id: 2,
    name: "Tubos plásticos",
    category_id: 1,
    category_name: "Material clínico",
    current_stock: 9,
    description: null,
  },
];

const mockAllergy: AllergyInventoryOverview[] = [];

function renderInventoryPage(): void {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, staleTime: Number.POSITIVE_INFINITY },
    },
  });
  queryClient.setQueryData(inventoryKeys.items().queryKey, mockItems);
  queryClient.setQueryData(inventoryKeys.allergyOverview().queryKey, mockAllergy);

  render(
    <QueryClientProvider client={queryClient}>
      <Suspense fallback={<output aria-label="Cargando">cargando</output>}>
        <InventoryPage />
      </Suspense>
    </QueryClientProvider>
  );
}

describe("InventoryPage", () => {
  beforeEach(() => {
    canMock.mockReset();
    canMock.mockImplementation(() => true);
    toastErrorMock.mockReset();
    toastSuccessMock.mockReset();
  });

  it("renders the inventory table with seeded items and the primary add button", () => {
    renderInventoryPage();

    expect(screen.getByRole("button", { name: /agregar item/i })).toBeEnabled();
    expect(screen.getByText("Lancetas estériles")).toBeInTheDocument();
    expect(screen.getByText("Tubos plásticos")).toBeInTheDocument();
    expect(screen.getByText(/reactivos y haptenos/i)).toBeInTheDocument();
  });

  it("disables Agregar item when user lacks create permission", () => {
    canMock.mockImplementation((action, subject) => {
      if (action === "create" && subject === "InventoryItem") {
        return false;
      }
      return true;
    });
    renderInventoryPage();
    expect(screen.getByRole("button", { name: /agregar item/i })).toBeDisabled();
  });

  it("opens the create-item modal via keyboard activation (Enter)", async () => {
    renderInventoryPage();
    const addButton = screen.getByRole("button", { name: /agregar item/i });
    const user = userEvent.setup();
    addButton.focus();
    expect(addButton).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(await screen.findByText(/agregar nuevo item/i)).toBeInTheDocument();
  });
});
