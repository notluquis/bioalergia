/**
 * Tests for `BulkToggleCell` — bulk-toggle cell in the permissions
 * matrix. The cell decides selected / indeterminate / empty state based
 * on how many of the grouped permission ids are already on the role.
 */

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { Role } from "@/types/roles";
import { BulkToggleCell } from "./BulkToggleCell";

function makeRole(overrides: Partial<Role> = {}): Role {
  return {
    id: 1,
    name: "Admin",
    description: "",
    isSystem: false,
    permissions: [],
    ...overrides,
  } as Role;
}

describe("BulkToggleCell", () => {
  it("renders an empty placeholder when there are no permission ids", () => {
    const { container } = render(
      <BulkToggleCell
        className="empty-cell"
        isUpdating={false}
        onToggle={vi.fn()}
        permissionIds={[]}
        role={makeRole()}
      />
    );
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    expect(container.querySelector(".empty-cell")).toBeInTheDocument();
  });

  it("shows a checked checkbox when every permission id is present on the role", () => {
    const role = makeRole({
      permissions: [{ permissionId: 1 }, { permissionId: 2 }] as Role["permissions"],
    });
    render(
      <BulkToggleCell isUpdating={false} onToggle={vi.fn()} permissionIds={[1, 2]} role={role} />
    );
    expect(screen.getByRole("checkbox")).toBeChecked();
  });

  it("renders an indeterminate visual when only some permissions are present", () => {
    const role = makeRole({
      permissions: [{ permissionId: 1 }] as Role["permissions"],
    });
    const { container } = render(
      <BulkToggleCell isUpdating={false} onToggle={vi.fn()} permissionIds={[1, 2]} role={role} />
    );
    expect(container.querySelector('[data-indeterminate="true"]')).toBeInTheDocument();
  });

  it("calls onToggle with the role + the grouped permission ids", async () => {
    const user = userEvent.setup();
    const onToggle = vi.fn();
    const role = makeRole();
    render(
      <BulkToggleCell
        isUpdating={false}
        onToggle={onToggle}
        permissionIds={[10, 20, 30]}
        role={role}
      />
    );
    await user.click(screen.getByRole("checkbox"));
    expect(onToggle).toHaveBeenCalledWith(role, [10, 20, 30]);
  });

  it("disables the checkbox while updating", async () => {
    const user = userEvent.setup();
    const onToggle = vi.fn();
    render(
      <BulkToggleCell isUpdating={true} onToggle={onToggle} permissionIds={[1]} role={makeRole()} />
    );
    expect(screen.getByRole("checkbox")).toBeDisabled();
    await user.click(screen.getByRole("checkbox"));
    expect(onToggle).not.toHaveBeenCalled();
  });
});
