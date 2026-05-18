/**
 * Tests for `Supplies` operational page — auth-gated form, refresh
 * button (a11y label + click handler), admin vs non-admin table title.
 *
 * Golden 2026 patterns: `vi.hoisted` shared mock state, module-boundary
 * mocks for child features only, fresh `QueryClient` per test, real
 * `userEvent` interactions, accessible-name assertions, a11y query.
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.hoisted(() => ({
  can: vi.fn<(action: string, subject: string) => boolean>(),
}));

const supplyMgmtMock = vi.hoisted(() => ({
  refresh: vi.fn<() => Promise<void>>(),
  handleStatusChange: vi.fn<(id: number, status: string) => void>(),
  commonSupplies: [] as Array<{ id: number; name: string }>,
  requests: [] as Array<{ id: number; status: string }>,
}));

vi.mock("@/context/AuthContext", () => ({
  useAuth: () => authMock,
}));

vi.mock("@/features/supplies/hooks/use-supply-management", () => ({
  useSupplyManagement: () => supplyMgmtMock,
}));

// Stub child UI to avoid pulling huge dependency graphs into this unit test.
vi.mock("@/features/supplies/components/SupplyRequestForm", () => ({
  SupplyRequestForm: () => <div data-testid="supply-request-form">form</div>,
}));

vi.mock("@/features/supplies/components/SupplyRequestsTable", () => ({
  SupplyRequestsTable: ({
    onStatusChange,
  }: {
    onStatusChange: (id: number, status: string) => void;
  }) => (
    <button type="button" data-testid="status-change-btn" onClick={() => onStatusChange(1, "DONE")}>
      table
    </button>
  ),
}));

const { Supplies } = await import("./SuppliesPage");

function renderWithProviders(ui: ReactNode) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

describe("operations/Supplies page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    supplyMgmtMock.refresh.mockResolvedValue(undefined);
  });

  it("renders create form when user can create SupplyRequest", () => {
    authMock.can.mockImplementation((_action, subject) => subject === "SupplyRequest");
    renderWithProviders(<Supplies />);
    expect(screen.getByTestId("supply-request-form")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /solicitar nuevo insumo/i })).toBeInTheDocument();
  });

  it("hides create form when user lacks create permission", () => {
    authMock.can.mockReturnValue(false);
    renderWithProviders(<Supplies />);
    expect(screen.queryByTestId("supply-request-form")).not.toBeInTheDocument();
  });

  it("shows admin title 'Todas las solicitudes' when user can update", () => {
    authMock.can.mockImplementation(
      (action, subject) => action === "update" && subject === "SupplyRequest"
    );
    renderWithProviders(<Supplies />);
    expect(screen.getByText("Todas las solicitudes")).toBeInTheDocument();
  });

  it("shows operator title 'Solicitudes activas' when user cannot update", () => {
    authMock.can.mockReturnValue(false);
    renderWithProviders(<Supplies />);
    expect(screen.getByText("Solicitudes activas")).toBeInTheDocument();
  });

  it("refresh button has accessible name and triggers refresh on click", async () => {
    authMock.can.mockReturnValue(false);
    const user = userEvent.setup();
    renderWithProviders(<Supplies />);

    const refreshBtn = await screen.findByRole("button", {
      name: /actualizar solicitudes de insumos/i,
    });
    expect(refreshBtn).toBeEnabled();

    await user.click(refreshBtn);
    expect(supplyMgmtMock.refresh).toHaveBeenCalledTimes(1);
  });

  it("forwards status changes only when admin can update", async () => {
    authMock.can.mockImplementation(
      (action, subject) => action === "update" && subject === "SupplyRequest"
    );
    const user = userEvent.setup();
    renderWithProviders(<Supplies />);

    await user.click(screen.getByTestId("status-change-btn"));
    expect(supplyMgmtMock.handleStatusChange).toHaveBeenCalledWith(1, "DONE");
  });

  it("swallows status changes when non-admin (no-op handler)", async () => {
    authMock.can.mockReturnValue(false);
    const user = userEvent.setup();
    renderWithProviders(<Supplies />);

    await user.click(screen.getByTestId("status-change-btn"));
    expect(supplyMgmtMock.handleStatusChange).not.toHaveBeenCalled();
  });
});
