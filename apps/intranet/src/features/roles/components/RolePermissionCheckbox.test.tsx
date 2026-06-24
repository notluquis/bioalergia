/**
 * Tests for `RolePermissionCheckbox` — leaf checkbox used inside the
 * permissions matrix. Pure presentational; assert on a11y + state.
 */

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { RolePermissionCheckbox } from "./RolePermissionCheckbox";

describe("RolePermissionCheckbox", () => {
  it("exposes the aria-label for screen readers", () => {
    render(
      <RolePermissionCheckbox
        ariaLabel="Permiso read Patient para rol Admin"
        isSelected={false}
        onChange={vi.fn()}
      />
    );
    expect(
      screen.getByRole("checkbox", { name: "Permiso read Patient para rol Admin" })
    ).toBeInTheDocument();
  });

  it("renders selected when isSelected is true", () => {
    render(<RolePermissionCheckbox ariaLabel="x" isSelected={true} onChange={vi.fn()} />);
    expect(screen.getByRole("checkbox")).toBeChecked();
  });

  it("calls onChange when toggled", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<RolePermissionCheckbox ariaLabel="x" isSelected={false} onChange={onChange} />);
    await user.click(screen.getByRole("checkbox"));
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("does not call onChange when disabled", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <RolePermissionCheckbox
        ariaLabel="x"
        isDisabled={true}
        isSelected={false}
        onChange={onChange}
      />
    );
    await user.click(screen.getByRole("checkbox"));
    expect(onChange).not.toHaveBeenCalled();
  });

  it("renders the indeterminate visual control when isIndeterminate is true", () => {
    const { container } = render(
      <RolePermissionCheckbox
        ariaLabel="x"
        isIndeterminate={true}
        isSelected={false}
        onChange={vi.fn()}
      />
    );
    // HeroUI sets data-indeterminate on the visual Checkbox.Control element.
    expect(container.querySelector('[data-indeterminate="true"]')).toBeInTheDocument();
  });

  it("disables the checkbox while updating", () => {
    render(
      <RolePermissionCheckbox
        ariaLabel="x"
        isDisabled={true}
        isSelected={true}
        isUpdating={true}
        onChange={vi.fn()}
      />
    );
    expect(screen.getByRole("checkbox")).toBeDisabled();
  });
});
