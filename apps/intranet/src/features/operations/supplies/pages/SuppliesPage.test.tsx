import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type * as AuthContextModule from "@/context/AuthContext";

import type { CommonSupply, SupplyRequest } from "@/features/supplies/types";

const canMock = vi.hoisted(() => vi.fn<(action: string, subject: string) => boolean>(() => true));
const refreshMock = vi.hoisted(() => vi.fn<() => Promise<void>>(() => Promise.resolve()));
const handleStatusChangeMock = vi.hoisted(() =>
  vi.fn<(id: number, status: SupplyRequest["status"]) => Promise<void>>(() => Promise.resolve())
);

const mockRequests: SupplyRequest[] = [
  {
    id: 101,
    supply_name: "Guantes nitrilo",
    brand: "MaxiSafe",
    model: "M",
    quantity: 5,
    status: "pending",
    created_at: new Date("2026-01-15T10:00:00Z"),
    notes: "Para box 2",
    user_email: "enfermeria@bioalergia.cl",
  },
  {
    id: 102,
    supply_name: "Algodón hidrófilo",
    quantity: 2,
    status: "delivered",
    created_at: new Date("2026-01-10T10:00:00Z"),
  },
];

const mockCommonSupplies: CommonSupply[] = [
  { id: 1, name: "Guantes nitrilo", brand: "MaxiSafe", model: "M" },
  { id: 2, name: "Algodón hidrófilo" },
];

vi.mock("@/context/AuthContext", async (importOriginal) => {
  const actual = await importOriginal<typeof AuthContextModule>();
  return {
    ...actual,
    useAuth: () => ({ can: canMock }),
  };
});

vi.mock("@/features/supplies/hooks/use-supply-management", () => ({
  useSupplyManagement: () => ({
    commonSupplies: mockCommonSupplies,
    handleStatusChange: handleStatusChangeMock,
    refresh: refreshMock,
    requests: mockRequests,
    structuredSupplies: {},
  }),
}));

vi.mock("@/features/supplies/components/SupplyRequestForm", () => ({
  SupplyRequestForm: ({ onSuccess }: { onSuccess: () => void }) => (
    <button type="button" onClick={onSuccess} aria-label="Crear solicitud mock">
      Crear solicitud mock
    </button>
  ),
}));

import { Supplies } from "./SuppliesPage";

function renderSuppliesPage(): void {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  render(
    <QueryClientProvider client={queryClient}>
      <Supplies />
    </QueryClientProvider>
  );
}

describe("SuppliesPage", () => {
  beforeEach(() => {
    canMock.mockReset();
    canMock.mockImplementation(() => true);
    refreshMock.mockClear();
    handleStatusChangeMock.mockClear();
  });

  it("renders create form, the requests table with seeded rows, and the refresh action", () => {
    renderSuppliesPage();
    expect(
      screen.getByRole("button", { name: /actualizar solicitudes de insumos/i })
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /crear solicitud mock/i })).toBeInTheDocument();
    expect(screen.getByText("Guantes nitrilo")).toBeInTheDocument();
    expect(screen.getByText("Algodón hidrófilo")).toBeInTheDocument();
  });

  it("uses the admin title when the user has update permission", () => {
    canMock.mockImplementation((action) => action === "update" || action === "create");
    renderSuppliesPage();
    expect(screen.getByText(/todas las solicitudes/i)).toBeInTheDocument();
  });

  it("uses the non-admin title when the user lacks update permission", () => {
    canMock.mockImplementation((action, subject) => {
      if (action === "update" && subject === "SupplyRequest") {
        return false;
      }
      return true;
    });
    renderSuppliesPage();
    expect(screen.getByText(/solicitudes activas/i)).toBeInTheDocument();
  });

  it("hides the create form when the user lacks create permission", () => {
    canMock.mockImplementation((action, subject) => {
      if (action === "create" && subject === "SupplyRequest") {
        return false;
      }
      return true;
    });
    renderSuppliesPage();
    expect(screen.queryByRole("button", { name: /crear solicitud mock/i })).not.toBeInTheDocument();
  });

  it("invokes refresh when the refresh button is activated via keyboard", async () => {
    renderSuppliesPage();
    const refreshButton = screen.getByRole("button", {
      name: /actualizar solicitudes de insumos/i,
    });
    const user = userEvent.setup();
    refreshButton.focus();
    expect(refreshButton).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(refreshMock).toHaveBeenCalledTimes(1);
  });
});
