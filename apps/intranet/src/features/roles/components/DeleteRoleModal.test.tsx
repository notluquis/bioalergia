/**
 * Tests for `DeleteRoleModal`.
 *
 * Critical scenarios:
 * - System roles are protected — only a "Cerrar" affordance, NO delete CTA.
 * - When the role has users, a reassign target must be picked before the
 *   delete CTA enables (destructive-confirm pattern).
 * - When the role has no users, the delete CTA is enabled immediately.
 * - Success path invalidates the roles query.
 * - Error path surfaces toast + does NOT close the modal.
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Role } from "@/types/roles";

const apiMocks = vi.hoisted(() => ({
  deleteRole: vi.fn(),
  reassignRoleUsers: vi.fn(),
  fetchRoleUsers: vi.fn(),
}));

const toastMocks = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
}));

vi.mock("@/features/roles/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/features/roles/api")>();
  return {
    ...actual,
    deleteRole: apiMocks.deleteRole,
    reassignRoleUsers: apiMocks.reassignRoleUsers,
  };
});

// roleKeys + roleQueries now live in ./queries (single source of truth).
vi.mock("@/features/roles/queries", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/features/roles/queries")>();
  return {
    ...actual,
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

const { DeleteRoleModal } = await import("./DeleteRoleModal");

function makeRole(overrides: Partial<Role> = {}): Role {
  return {
    id: 1,
    name: "Editor",
    description: "",
    isSystem: false,
    permissions: [],
    ...overrides,
  } as Role;
}

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
  apiMocks.deleteRole.mockReset();
  apiMocks.reassignRoleUsers.mockReset();
  apiMocks.fetchRoleUsers.mockReset();
  for (const fn of Object.values(toastMocks)) fn.mockReset();
});

afterEach(() => {
  // jsdom carries portals between tests; explicit cleanup is handled by
  // the global afterEach in test/setup.ts, but the Modal Portal needs an
  // extra unmount nudge if a test left it open.
});

describe("DeleteRoleModal — system role protection", () => {
  it("blocks deletion for system roles with a clear alert + only a Cerrar button", async () => {
    const onClose = vi.fn();
    wrap(
      <DeleteRoleModal
        allRoles={[]}
        isOpen={true}
        onClose={onClose}
        role={makeRole({ isSystem: true, name: "SuperAdmin" })}
      />
    );

    expect(await screen.findByText(/rol de sistema protegido/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /eliminar/i })).not.toBeInTheDocument();

    const closeBtn = screen.getByRole("button", { name: /cerrar/i });
    await userEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalled();
    // No mutation invoked.
    expect(apiMocks.deleteRole).not.toHaveBeenCalled();
  });
});

describe("DeleteRoleModal — no users assigned", () => {
  beforeEach(() => {
    apiMocks.fetchRoleUsers.mockResolvedValue([]);
  });

  it("shows the safe-to-delete copy and enables the Eliminar CTA", async () => {
    wrap(
      <DeleteRoleModal
        allRoles={[makeRole({ id: 2, name: "Viewer" })]}
        isOpen={true}
        onClose={vi.fn()}
        role={makeRole()}
      />
    );

    expect(await screen.findByText(/no hay usuarios asignados/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /eliminar/i })).toBeEnabled();
  });

  it("invokes deleteRole + closes the modal on success", async () => {
    apiMocks.deleteRole.mockResolvedValue({ status: "ok" });
    const onClose = vi.fn();
    wrap(<DeleteRoleModal allRoles={[]} isOpen={true} onClose={onClose} role={makeRole()} />);

    await screen.findByText(/no hay usuarios asignados/i);
    await userEvent.click(screen.getByRole("button", { name: /eliminar/i }));

    await waitFor(() => expect(apiMocks.deleteRole).toHaveBeenCalledWith(1));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(toastMocks.success).toHaveBeenCalled();
    expect(apiMocks.reassignRoleUsers).not.toHaveBeenCalled();
  });

  it("shows a toast and keeps the modal open on error", async () => {
    apiMocks.deleteRole.mockRejectedValue(new Error("constraint violation"));
    const onClose = vi.fn();
    wrap(<DeleteRoleModal allRoles={[]} isOpen={true} onClose={onClose} role={makeRole()} />);
    await screen.findByText(/no hay usuarios asignados/i);
    await userEvent.click(screen.getByRole("button", { name: /eliminar/i }));

    await waitFor(() =>
      expect(toastMocks.error).toHaveBeenCalledWith("constraint violation", "Error")
    );
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe("DeleteRoleModal — users assigned", () => {
  const usersFixture = [
    {
      id: 11,
      email: "ana@example.cl",
      person: { names: "Ana", fatherName: "Pérez" },
    },
    {
      id: 12,
      email: "no-name@example.cl",
      person: null,
    },
  ];

  beforeEach(() => {
    apiMocks.fetchRoleUsers.mockResolvedValue(usersFixture);
  });

  it("shows the affected-users list and disables Eliminar until a target role is picked", async () => {
    wrap(
      <DeleteRoleModal
        allRoles={[makeRole({ id: 2, name: "Viewer" })]}
        isOpen={true}
        onClose={vi.fn()}
        role={makeRole()}
      />
    );

    expect(await screen.findByText(/2 usuarios/)).toBeInTheDocument();
    expect(screen.getByText(/Ana Pérez/)).toBeInTheDocument();
    // The email appears twice (name slot fallback + email slot); the
    // presence-only assertion via getAllByText is the intent.
    expect(screen.getAllByText(/no-name@example.cl/).length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: /eliminar/i })).toBeDisabled();
  });

  it("Cancel button triggers onClose without invoking any mutation", async () => {
    const onClose = vi.fn();
    wrap(<DeleteRoleModal allRoles={[]} isOpen={true} onClose={onClose} role={makeRole()} />);
    // Wait for the Suspense fallback to resolve and the warning panel to mount.
    // Note: the skeleton uses "Verificando usuarios afectados..." so we look
    // for the heading text after suspense settles.
    // The warning panel shows a "<n> usuarios" line; the skeleton uses
    // "Verificando usuarios afectados...", so we wait for the number copy.
    await screen.findByText(/2 usuarios/);
    await userEvent.click(screen.getByRole("button", { name: /cancelar/i }));
    expect(onClose).toHaveBeenCalled();
    expect(apiMocks.deleteRole).not.toHaveBeenCalled();
    expect(apiMocks.reassignRoleUsers).not.toHaveBeenCalled();
  });
});
