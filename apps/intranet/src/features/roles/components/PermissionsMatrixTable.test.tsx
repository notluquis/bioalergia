/**
 * Tests for `PermissionsMatrixTable` — the cross-tabulated permissions
 * grid used in Settings → Roles.
 *
 * Focus: structural rendering + interaction callbacks. Avoid asserting
 * on the full grid layout (CSS) — that's Storybook visual coverage.
 */

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ShieldIcon } from "lucide-react";
import { beforeAll, describe, expect, it, vi } from "vitest";

// jsdom lacks ResizeObserver — HeroUI's ScrollShadow needs it.
beforeAll(() => {
  if (typeof globalThis.ResizeObserver === "undefined") {
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver;
  }
});
import type { Permission, Role } from "@/types/roles";
import { type MatrixSection, PermissionsMatrixTable } from "./PermissionsMatrixTable";

function makeRole(id: number, name: string, permissionIds: number[] = []): Role {
  return {
    id,
    name,
    description: `${name} description`,
    isSystem: false,
    permissions: permissionIds.map((permissionId) => ({ permissionId })),
  } as Role;
}

function makePerm(id: number, action: string, subject: string): Permission {
  return { id, action, subject } as Permission;
}

const sampleRoles = [makeRole(1, "Admin", [10]), makeRole(2, "Viewer")];

const sampleSections: MatrixSection[] = [
  {
    title: "Pacientes",
    permissionIds: [10, 11],
    items: [
      {
        icon: ShieldIcon,
        label: "Ficha clínica",
        permissionIds: [10, 11],
        relatedPermissions: [makePerm(10, "read", "Patient"), makePerm(11, "update", "Patient")],
      },
      {
        icon: ShieldIcon,
        label: "Adjuntos",
        permissionIds: [12],
        relatedPermissions: [makePerm(12, "delete", "Attachment")],
      },
    ],
  },
];

function defaultProps() {
  return {
    isUpdatingPermissions: false,
    onBulkToggle: vi.fn(),
    onDeleteRole: vi.fn(),
    onEditRole: vi.fn(),
    onImpersonate: vi.fn(),
    onPermissionToggle: vi.fn(),
    roles: sampleRoles,
    sections: sampleSections,
    viewModeRole: "all",
  };
}

describe("PermissionsMatrixTable", () => {
  it("renders one column header per role with name + description", () => {
    render(<PermissionsMatrixTable {...defaultProps()} />);
    expect(screen.getByText("Admin")).toBeInTheDocument();
    expect(screen.getByText("Viewer")).toBeInTheDocument();
    expect(screen.getByText("Admin description")).toBeInTheDocument();
  });

  it("filters columns when viewModeRole is set to a specific role id", () => {
    render(<PermissionsMatrixTable {...defaultProps()} viewModeRole="1" />);
    expect(screen.getByText("Admin")).toBeInTheDocument();
    expect(screen.queryByText("Viewer")).not.toBeInTheDocument();
  });

  it("renders one section row with the section title", () => {
    render(<PermissionsMatrixTable {...defaultProps()} />);
    expect(screen.getByText("Pacientes")).toBeInTheDocument();
  });

  it("expands a section when the section toggle is clicked", async () => {
    const user = userEvent.setup();
    render(<PermissionsMatrixTable {...defaultProps()} />);
    // Items not visible by default (section collapsed).
    expect(screen.queryByText(/Ficha clínica/i)).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Pacientes/i }));
    expect(await screen.findByText(/Ficha clínica/i)).toBeInTheDocument();
  });

  it("renders single-permission items with the localised action label", async () => {
    const user = userEvent.setup();
    render(<PermissionsMatrixTable {...defaultProps()} />);
    await user.click(screen.getByRole("button", { name: /Pacientes/i }));
    // Adjuntos has a single permission (delete) → flattens with "(Eliminar)".
    expect(await screen.findByText(/Adjuntos \(Eliminar\)/)).toBeInTheDocument();
  });

  it("invokes onPermissionToggle when a single-permission checkbox is clicked", async () => {
    const user = userEvent.setup();
    const props = defaultProps();
    render(<PermissionsMatrixTable {...props} />);
    await user.click(screen.getByRole("button", { name: /Pacientes/i }));

    // Find the Adjuntos delete permission checkbox by aria-label.
    const cb = await screen.findByRole("checkbox", {
      name: /Permiso 12 para rol Admin/i,
    });
    await user.click(cb);

    expect(props.onPermissionToggle).toHaveBeenCalledWith(
      expect.objectContaining({ id: 1, name: "Admin" }),
      12
    );
  });
});
