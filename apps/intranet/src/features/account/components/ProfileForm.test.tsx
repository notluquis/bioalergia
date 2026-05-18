/**
 * Tests for `ProfileForm` — the reusable self-service profile editor.
 *
 * Scope (golden 2026):
 *  - Renders every identity + financial field with `<TextField>` /
 *    `<Select>` HeroUI v3 compound components (no native inputs).
 *  - Zod validation (reused from `profileSchema`) blocks submit on
 *    invalid RUT / empty names.
 *  - RUT is read-only by default (post-setup) and editable when
 *    `allowRutEdit` is true (onboarding wizard).
 *  - Mutating `loginEmail` away from the initial value surfaces a
 *    yellow warning Alert.
 *  - Success path: `onSubmit` resolves → no inline error shown.
 *  - Error path: `onSubmit` rejects → message rendered in the danger
 *    Alert.
 */
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ProfileForm, type ProfileFormValues } from "./ProfileForm";

// Valid Chilean RUT for happy-path payloads (módulo-11 verified).
const VALID_RUT = "11.111.111-1";

const baseValues: ProfileFormValues = {
  names: "Ana Pérez",
  fatherName: "Pérez",
  motherName: "Soto",
  loginEmail: "ana@example.com",
  phone: "+56912345678",
  rut: VALID_RUT,
  bankName: "",
  bankAccountType: "",
  bankAccountNumber: "",
};

describe("ProfileForm", () => {
  it("renders all expected fields with initial values", () => {
    render(
      <ProfileForm
        initialValues={baseValues}
        onSubmit={vi.fn<(values: ProfileFormValues) => Promise<void>>()}
      />
    );

    // Identity surface.
    expect(screen.getByLabelText(/nombres/i)).toHaveValue("Ana Pérez");
    expect(screen.getByLabelText(/primer apellido/i)).toHaveValue("Pérez");
    expect(screen.getByLabelText(/segundo apellido/i)).toHaveValue("Soto");
    expect(screen.getByLabelText(/correo de inicio de sesión/i)).toHaveValue("ana@example.com");
    expect(screen.getByLabelText(/teléfono/i)).toHaveValue("+56912345678");
    // RUT field is rendered (read-only default).
    expect(screen.getByLabelText(/rut/i)).toBeInTheDocument();
    // Financial.
    expect(screen.getByLabelText(/banco/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/número de cuenta/i)).toBeInTheDocument();
  });

  it("renders RUT as read-only by default (post-setup lock)", () => {
    render(
      <ProfileForm
        initialValues={baseValues}
        onSubmit={vi.fn<(values: ProfileFormValues) => Promise<void>>()}
      />
    );
    const rut = screen.getByLabelText(/rut/i);
    expect(rut).toHaveAttribute("readonly");
  });

  it("renders RUT as editable when allowRutEdit is true (onboarding)", () => {
    render(
      <ProfileForm
        allowRutEdit
        initialValues={baseValues}
        onSubmit={vi.fn<(values: ProfileFormValues) => Promise<void>>()}
      />
    );
    const rut = screen.getByLabelText(/rut/i);
    expect(rut).not.toHaveAttribute("readonly");
  });

  it("calls onSubmit with the current values on submit success", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn<(values: ProfileFormValues) => Promise<void>>(() => Promise.resolve());

    render(<ProfileForm initialValues={baseValues} onSubmit={onSubmit} />);

    const nameInput = screen.getByLabelText(/nombres/i);
    await user.clear(nameInput);
    await user.type(nameInput, "Ana María Pérez");

    await user.click(screen.getByRole("button", { name: /guardar cambios/i }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit.mock.calls[0]?.[0]?.names).toBe("Ana María Pérez");
  });

  it("surfaces server error message in the inline alert", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn<(values: ProfileFormValues) => Promise<void>>(() =>
      Promise.reject(new Error("Email ya en uso"))
    );

    render(<ProfileForm initialValues={baseValues} onSubmit={onSubmit} />);

    await user.click(screen.getByRole("button", { name: /guardar cambios/i }));

    expect(await screen.findByText(/email ya en uso/i)).toBeInTheDocument();
  });

  it("shows the loginEmail warning when the email differs from the initial value", async () => {
    const user = userEvent.setup();
    render(
      <ProfileForm
        initialValues={baseValues}
        onSubmit={vi.fn<(values: ProfileFormValues) => Promise<void>>()}
      />
    );

    // No warning visible initially.
    expect(screen.queryByText(/cambio de correo de inicio/i)).not.toBeInTheDocument();

    const loginEmail = screen.getByLabelText(/correo de inicio de sesión/i);
    await user.clear(loginEmail);
    await user.type(loginEmail, "ana.new@example.com");

    expect(screen.getByText(/cambio de correo de inicio/i)).toBeInTheDocument();
  });

  it("disables submit when names is empty (zod minLength gate)", async () => {
    const user = userEvent.setup();
    render(
      <ProfileForm
        initialValues={{ ...baseValues, names: "" }}
        onSubmit={vi.fn<(values: ProfileFormValues) => Promise<void>>()}
      />
    );

    const submit = screen.getByRole("button", { name: /guardar cambios/i });
    expect(submit).toBeDisabled();

    await user.type(screen.getByLabelText(/nombres/i), "Ana");
    expect(submit).not.toBeDisabled();
  });

  it("disables submit on invalid RUT when allowRutEdit is true", () => {
    render(
      <ProfileForm
        allowRutEdit
        initialValues={{ ...baseValues, rut: "invalid" }}
        onSubmit={vi.fn<(values: ProfileFormValues) => Promise<void>>()}
      />
    );
    expect(screen.getByRole("button", { name: /siguiente|guardar/i })).toBeDisabled();
  });

  it("hides the bank-account section when hideFinancial is true", () => {
    render(
      <ProfileForm
        hideFinancial
        initialValues={baseValues}
        onSubmit={vi.fn<(values: ProfileFormValues) => Promise<void>>()}
      />
    );
    expect(screen.queryByLabelText(/banco/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/número de cuenta/i)).not.toBeInTheDocument();
  });
});
