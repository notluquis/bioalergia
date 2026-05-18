/**
 * Tests for `RoleFormModal` — create / edit role form with validation.
 *
 * Covers:
 * - Create mode renders a "Crear Rol" CTA and no Suspense-bound users list.
 * - Submit a valid form → createRole called, modal closed, success toast.
 * - Error path → toast surfaced, modal stays open.
 * - Validation: empty name blocks submission (zod min(1)).
 * - Edit mode: prefills inputs from the role + shows affected users.
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Role } from "@/types/roles";

const apiMocks = vi.hoisted(() => ({
  createRole: vi.fn(),
  updateRole: vi.fn(),
  fetchRoleUsers: vi.fn(),
}));

const toastMocks = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
}));

vi.mock("@/features/roles/api", async () => {
  const actual =
    await vi.importActual<typeof import("@/features/roles/api")>("@/features/roles/api");
  return {
    ...actual,
    createRole: apiMocks.createRole,
    updateRole: apiMocks.updateRole,
    roleQueries: {
      ...actual.roleQueries,
      users: (roleId: number) => ({
        queryKey: ["roles", roleId, "users"],
        queryFn: () => apiMocks.fetchRoleUsers(roleId),
      }),
    },
  };
});

vi.mock("@/context/ToastContext", () => ({
  useToast: () => toastMocks,
}));

const { RoleFormModal } = await import("./RoleFormModal");

function wrap(ui: ReactNode) {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

beforeEach(() => {
  apiMocks.createRole.mockReset();
  apiMocks.updateRole.mockReset();
  apiMocks.fetchRoleUsers.mockReset();
  for (const fn of Object.values(toastMocks)) fn.mockReset();
});

describe("RoleFormModal — create mode", () => {
  it("renders the Crear Rol heading and CTA", async () => {
    wrap(<RoleFormModal isOpen={true} onClose={vi.fn()} role={null} />);
    expect(await screen.findByText("Nuevo Rol")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /crear rol/i })).toBeInTheDocument();
  });

  it("submits a valid form and closes on success", async () => {
    const user = userEvent.setup();
    apiMocks.createRole.mockResolvedValue({ status: "ok" });
    const onClose = vi.fn();
    wrap(<RoleFormModal isOpen={true} onClose={onClose} role={null} />);

    await user.type(screen.getByLabelText(/nombre del rol/i), "Supervisor");
    await user.click(screen.getByRole("button", { name: /crear rol/i }));

    await waitFor(() =>
      expect(apiMocks.createRole).toHaveBeenCalledWith({
        name: "Supervisor",
        description: "",
      })
    );
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(toastMocks.success).toHaveBeenCalled();
  });

  it("shows a toast and keeps the modal open on API error", async () => {
    const user = userEvent.setup();
    apiMocks.createRole.mockRejectedValue(new Error("duplicate name"));
    const onClose = vi.fn();
    wrap(<RoleFormModal isOpen={true} onClose={onClose} role={null} />);

    await user.type(screen.getByLabelText(/nombre del rol/i), "Supervisor");
    await user.click(screen.getByRole("button", { name: /crear rol/i }));

    await waitFor(() => expect(toastMocks.error).toHaveBeenCalledWith("duplicate name", "Error"));
    expect(onClose).not.toHaveBeenCalled();
  });

  it("does not call createRole when the name field is empty", async () => {
    const user = userEvent.setup();
    wrap(<RoleFormModal isOpen={true} onClose={vi.fn()} role={null} />);
    // Don't type anything; click submit.
    await user.click(screen.getByRole("button", { name: /crear rol/i }));
    // Zod min(1) keeps the mutation from firing.
    await new Promise((r) => setTimeout(r, 50));
    expect(apiMocks.createRole).not.toHaveBeenCalled();
  });
});

describe("RoleFormModal — edit mode", () => {
  const editableRole: Role = {
    id: 7,
    name: "Editor",
    description: "Manages content",
    isSystem: false,
    permissions: [],
  } as Role;

  it("prefills the form with the role data + shows affected users", async () => {
    apiMocks.fetchRoleUsers.mockResolvedValue([
      { id: 1, email: "user@example.cl", person: { names: "Ana", fatherName: "Pérez" } },
    ]);

    wrap(<RoleFormModal isOpen={true} onClose={vi.fn()} role={editableRole} />);

    expect(await screen.findByText("Editar Rol")).toBeInTheDocument();
    const nameInput = await screen.findByLabelText<HTMLInputElement>(/nombre del rol/i);
    expect(nameInput.value).toBe("Editor");
    expect(screen.getByText("Ana Pérez")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /guardar cambios/i })).toBeInTheDocument();
  });

  it("calls updateRole with the form payload on submit", async () => {
    apiMocks.fetchRoleUsers.mockResolvedValue([]);
    apiMocks.updateRole.mockResolvedValue({ status: "ok" });
    const onClose = vi.fn();
    const user = userEvent.setup();

    wrap(<RoleFormModal isOpen={true} onClose={onClose} role={editableRole} />);

    await screen.findByText("Editar Rol");
    const nameInput = await screen.findByLabelText<HTMLInputElement>(/nombre del rol/i);
    await user.clear(nameInput);
    await user.type(nameInput, "Editor v2");
    await user.click(screen.getByRole("button", { name: /guardar cambios/i }));

    await waitFor(() =>
      expect(apiMocks.updateRole).toHaveBeenCalledWith(7, {
        name: "Editor v2",
        description: "Manages content",
      })
    );
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });
});
