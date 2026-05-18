import {
  Alert,
  Button,
  Description,
  FieldError,
  Form,
  Input,
  Label,
  ListBox,
  Select,
  TextField,
} from "@heroui/react";
import { CreditCard, User } from "lucide-react";
import { type FormEvent, useCallback, useMemo, useState } from "react";

import { profileSchema } from "@/pages/onboarding/hooks/useOnboardingForm";
import { formatRut, validateRut } from "@/lib/rut";

/**
 * Reusable self-service profile form.
 *
 * Used by:
 *  - `/account?tab=perfil` (`ProfilePanel`) — standalone edit flow.
 *  - `/onboarding` wizard step 1 (`ProfileStep`) — initial-setup flow.
 *
 * Shape choices (golden 2026):
 *  - Internal `useState` only, NEVER wizard state (composable everywhere).
 *  - Zod validation reuses `profileSchema` from the onboarding hook so the
 *    wizard + self-service surface stay in lockstep — single source of
 *    truth for "what a valid profile looks like".
 *  - HeroUI v3 compound components only; native form/input/button banned
 *    by the design audit script.
 *  - RUT is read-only post-setup (server pulls existing RUT from DB),
 *    surfaced visually with `isReadOnly` so users don't try to edit it.
 *  - Changing `loginEmail` impacts future login — show a yellow Alert
 *    when the user mutates the value so they don't lock themselves out.
 */

const NO_ACCOUNT_TYPE_KEY = "__no_account_type__";
const ACCOUNT_TYPES: { id: string; label: string }[] = [
  { id: "Corriente", label: "Cuenta corriente" },
  { id: "Vista", label: "Cuenta vista / RUT" },
  { id: "Ahorro", label: "Cuenta de ahorro" },
];

export interface ProfileFormValues {
  names: string;
  fatherName: string;
  motherName: string;
  loginEmail: string;
  phone: string;
  rut: string;
  bankName: string;
  bankAccountType: string;
  bankAccountNumber: string;
}

export interface ProfileFormProps {
  initialValues: ProfileFormValues;
  /**
   * Resolves on success; rejected promise surfaces as inline error
   * Alert (caller is also free to toast — both paths coexist).
   */
  onSubmit: (values: ProfileFormValues) => Promise<void>;
  isSubmitting?: boolean;
  /**
   * Submit-button label. Defaults to "Guardar cambios".
   * Onboarding wizard overrides with "Siguiente".
   */
  submitLabel?: string;
  /**
   * Optional cancel/back button. When provided, rendered alongside the
   * submit. Onboarding wizard hides it (no prev on step 0); standalone
   * panel hides it too.
   */
  onCancel?: () => void;
  cancelLabel?: string;
  /**
   * Hide the bank-account section. Used by the onboarding wizard which
   * surfaces banking as a dedicated step 2 (`FinancialStep`).
   */
  hideFinancial?: boolean;
  /**
   * Allow the RUT field to be edited. Default `false` (post-setup the
   * RUT is locked); the onboarding wizard flips this to `true` so a
   * user can complete their identity during initial setup.
   */
  allowRutEdit?: boolean;
}

export function ProfileForm(props: ProfileFormProps) {
  const {
    initialValues,
    onSubmit,
    isSubmitting,
    submitLabel = "Guardar cambios",
    onCancel,
    cancelLabel = "Cancelar",
    hideFinancial = false,
    allowRutEdit = false,
  } = props;

  const [values, setValues] = useState<ProfileFormValues>(initialValues);
  const [error, setError] = useState<null | string>(null);
  const initialLoginEmail = useMemo(() => initialValues.loginEmail, [initialValues.loginEmail]);

  const update = useCallback(
    <K extends keyof ProfileFormValues>(field: K, value: ProfileFormValues[K]) => {
      setValues((prev) => ({ ...prev, [field]: value }));
      setError(null);
    },
    []
  );

  const loginEmailChanged = values.loginEmail.trim() !== initialLoginEmail.trim();
  const namesValid = values.names.trim().length > 0;
  const rutValid = validateRut(values.rut);

  const handleSubmit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setError(null);

      const parsed = profileSchema.safeParse({
        names: values.names,
        loginEmail: values.loginEmail || "",
        rut: values.rut,
        phone: values.phone,
        fatherName: values.fatherName,
        motherName: values.motherName,
      });

      if (!parsed.success) {
        const firstIssue = parsed.error.issues[0];
        setError(firstIssue?.message ?? "Datos inválidos");
        return;
      }

      void (async () => {
        try {
          await onSubmit(values);
        } catch (submitError) {
          const message =
            submitError instanceof Error ? submitError.message : "Error al guardar el perfil";
          setError(message);
        }
      })();
    },
    [onSubmit, values]
  );

  return (
    <Form className="space-y-6" onSubmit={handleSubmit} validationBehavior="aria">
      <div className="mb-2 flex items-center gap-3 px-1">
        <div className="flex items-center justify-center rounded-full bg-primary/10 text-primary size-10">
          <User size={20} />
        </div>
        <div>
          <h3 className="font-semibold text-lg text-foreground">Datos personales</h3>
          <p className="text-default-500 text-xs">Información básica para tu cuenta.</p>
        </div>
      </div>

      {error ? (
        <Alert status="danger">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>No se pudo guardar</Alert.Title>
            <Alert.Description>{error}</Alert.Description>
          </Alert.Content>
        </Alert>
      ) : null}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <TextField
          isRequired
          name="names"
          onChange={(v) => update("names", v)}
          value={values.names}
        >
          <Label>Nombres</Label>
          <Input />
          <FieldError>Los nombres son requeridos</FieldError>
        </TextField>

        <TextField
          name="loginEmail"
          onChange={(v) => update("loginEmail", v)}
          type="email"
          value={values.loginEmail}
        >
          <Label>Correo de inicio de sesión</Label>
          <Input />
          <Description>
            Este es el correo con el que inicias sesión. Cámbialo solo si necesitas un correo
            distinto al de contacto.
          </Description>
        </TextField>

        {allowRutEdit ? (
          <TextField
            isInvalid={values.rut.length > 0 && !rutValid}
            isRequired
            name="rut"
            onChange={(v) => update("rut", v)}
            value={values.rut}
          >
            <Label>RUT</Label>
            <Input onBlur={() => update("rut", formatRut(values.rut))} placeholder="12.345.678-9" />
            <FieldError>RUT inválido</FieldError>
          </TextField>
        ) : (
          <TextField
            isReadOnly
            isRequired
            name="rut"
            value={values.rut ? formatRut(values.rut) : ""}
          >
            <Label>RUT</Label>
            <Input />
            <Description>
              El RUT no puede modificarse desde aquí. Contacta a un administrador para corregirlo.
            </Description>
          </TextField>
        )}

        <TextField
          name="phone"
          onChange={(v) => update("phone", v)}
          type="tel"
          value={values.phone}
        >
          <Label>Teléfono</Label>
          <Input placeholder="+56 9 1234 5678" />
        </TextField>

        <TextField
          name="fatherName"
          onChange={(v) => update("fatherName", v)}
          value={values.fatherName}
        >
          <Label>Primer apellido</Label>
          <Input />
        </TextField>

        <TextField
          name="motherName"
          onChange={(v) => update("motherName", v)}
          value={values.motherName}
        >
          <Label>Segundo apellido</Label>
          <Input />
        </TextField>
      </div>

      {loginEmailChanged ? (
        <Alert status="warning">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>Cambio de correo de inicio de sesión</Alert.Title>
            <Alert.Description>
              Si guardas este cambio, tendrás que iniciar sesión con{" "}
              <strong>{values.loginEmail || "(vacío)"}</strong> la próxima vez. El correo anterior
              dejará de funcionar para iniciar sesión.
            </Alert.Description>
          </Alert.Content>
        </Alert>
      ) : null}

      {hideFinancial ? null : (
        <>
          <div className="mt-4 mb-2 flex items-center gap-3 px-1">
            <div className="flex items-center justify-center rounded-full bg-secondary/10 text-secondary size-10">
              <CreditCard size={20} />
            </div>
            <div>
              <h3 className="font-semibold text-lg text-foreground">Datos bancarios</h3>
              <p className="text-default-500 text-xs">Para gestionar tus pagos y remuneraciones.</p>
            </div>
          </div>

          <div className="space-y-4">
            <TextField
              name="bankName"
              onChange={(v) => update("bankName", v)}
              value={values.bankName}
            >
              <Label>Banco</Label>
              <Input placeholder="Ej: Banco de Chile" />
            </TextField>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Select
                onChange={(key) =>
                  update("bankAccountType", key === NO_ACCOUNT_TYPE_KEY ? "" : (key as string))
                }
                value={values.bankAccountType || NO_ACCOUNT_TYPE_KEY}
              >
                <Label>Tipo de cuenta</Label>
                <Select.Trigger>
                  <Select.Value />
                  <Select.Indicator />
                </Select.Trigger>
                <Select.Popover>
                  <ListBox>
                    <ListBox.Item id={NO_ACCOUNT_TYPE_KEY} key={NO_ACCOUNT_TYPE_KEY}>
                      Seleccionar...
                    </ListBox.Item>
                    {ACCOUNT_TYPES.map((opt) => (
                      <ListBox.Item id={opt.id} key={opt.id} textValue={opt.label}>
                        {opt.label}
                      </ListBox.Item>
                    ))}
                  </ListBox>
                </Select.Popover>
              </Select>

              <TextField
                name="bankAccountNumber"
                onChange={(v) => update("bankAccountNumber", v)}
                value={values.bankAccountNumber}
              >
                <Label>Número de cuenta</Label>
                <Input />
              </TextField>
            </div>
          </div>
        </>
      )}

      <div className="mt-6 flex justify-end gap-3">
        {onCancel ? (
          <Button isDisabled={isSubmitting} onPress={onCancel} type="button" variant="outline">
            {cancelLabel}
          </Button>
        ) : null}
        <Button
          className="px-8"
          isDisabled={isSubmitting || !namesValid || !rutValid}
          type="submit"
          variant="primary"
        >
          {submitLabel}
        </Button>
      </div>
    </Form>
  );
}
