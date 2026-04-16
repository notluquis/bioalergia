import {
  Button,
  Checkbox,
  Description,
  FieldError,
  Label,
  ListBox,
  Select,
  Spinner,
} from "@heroui/react";
import { type ReactFormExtendedApi, useForm } from "@tanstack/react-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Shield, UserPlus, Users } from "lucide-react";
import { TanStackInputField } from "@/components/forms/TanStackFieldControls";
import { useToast } from "@/context/ToastContext";
import { fetchPeople, type PersonWithExtras } from "@/features/people/api";
import { fetchRoles } from "@/features/roles/api";
import { inviteUser, type InviteUserPayload } from "@/features/users/api";
import { usePersonLinking } from "@/features/users/hooks/usePersonLinking";
import { ApiError } from "@/lib/api-client";
import { getPersonFullName } from "@/lib/person";

interface AddUserFormState {
  email: string;
  fatherName: string;
  linkToPerson: boolean;
  mfaEnforced: boolean;
  motherName: string;
  names: string;
  passkeyOnly: boolean;
  personId: number | undefined;
  position: string;
  role: string;
  rut: string;
}

interface AddUserFormContainerProps {
  onCancel: () => void;
  onCreated?: () => void;
  showPageHeader?: boolean;
}

export function AddUserFormContainer({
  onCancel,
  onCreated,
  showPageHeader = true,
}: Readonly<AddUserFormContainerProps>) {
  const queryClient = useQueryClient();
  const { error: toastError, success } = useToast();

  const { data: rolesData, isLoading: isRolesLoading } = useQuery({
    queryFn: fetchRoles,
    queryKey: ["roles"],
  });
  const roles = rolesData ?? [];

  // Fetch people without users
  const {
    data: peopleResult,
    isLoading: isPeopleLoading,
    error: peopleError,
  } = useQuery({
    queryFn: async () => {
      try {
        const people = await fetchPeople();
        return { denied: false, people };
      } catch (error) {
        // If the current role can't read Person, continue without linkable people.
        if (error instanceof ApiError && error.status === 403) {
          return { denied: true, people: [] };
        }
        throw error;
      }
    },
    queryKey: ["people"],
    retry: (failureCount, error) => {
      if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
        return false;
      }
      return failureCount < 1;
    },
  });

  const isPeoplePermissionDenied = peopleResult?.denied ?? false;

  // Filter people who don't have a user yet and exclude test users
  const availablePeople =
    peopleResult?.people.filter(
      (p) =>
        !p.user &&
        !p.hasUser &&
        !p.names.toLowerCase().includes("test") &&
        !p.names.toLowerCase().includes("usuario prueba")
    ) || [];

  // Create user mutation
  const createUserMutation = useMutation({
    mutationFn: inviteUser,
    onError: (err) => {
      toastError(err instanceof Error ? err.message : "Error al crear usuario");
    },
    onSuccess: async () => {
      success("Usuario creado exitosamente");
      void Promise.all([
        queryClient.invalidateQueries({ queryKey: ["users"] }),
        queryClient.invalidateQueries({ queryKey: ["people"] }),
      ]);
      onCreated?.();
    },
  });

  const form = useForm({
    defaultValues: {
      email: "",
      fatherName: "",
      linkToPerson: false,
      mfaEnforced: true,
      motherName: "",
      names: "",
      passkeyOnly: false,
      personId: undefined,
      position: "",
      role: "VIEWER",
      rut: "",
    } as AddUserFormState,
    onSubmit: async ({ value }) => {
      const payload: InviteUserPayload = {
        email: value.email,
        mfaEnforced: value.mfaEnforced,
        position: value.position,
        role: value.role,
      };

      if (value.linkToPerson && value.personId) {
        payload.personId = value.personId;
      } else {
        payload.names = value.names;
        payload.fatherName = value.fatherName;
        payload.motherName = value.motherName;
        payload.rut = value.rut;
      }

      await createUserMutation.mutateAsync(payload);
    },
  });

  const { handleLinkPerson } = usePersonLinking(form, availablePeople);

  if (isPeopleLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Spinner aria-label="Cargando" color="accent" size="lg" />
      </div>
    );
  }

  if (peopleError) {
    console.error(peopleError);
    return (
      <div className="mx-auto max-w-2xl space-y-8">
        <div className="surface-elevated rounded-3xl p-6 shadow-lg">
          <Description className="text-danger">
            Error al cargar datos: {String(peopleError)}
          </Description>
          <Button onPress={onCancel} className="mt-4">
            Volver
          </Button>
        </div>
      </div>
    );
  }

  return (
    <AddUserFormCard
      availablePeople={availablePeople}
      form={form as AddUserFormApi}
      handleLinkPerson={handleLinkPerson}
      isPeoplePermissionDenied={isPeoplePermissionDenied}
      isRolesLoading={isRolesLoading}
      isSubmitPending={createUserMutation.isPending}
      onCancel={onCancel}
      roles={roles}
      showPageHeader={showPageHeader}
    />
  );
}

type AddUserFormApi = ReactFormExtendedApi<
  AddUserFormState,
  undefined,
  undefined,
  undefined,
  undefined,
  undefined,
  undefined,
  undefined,
  undefined,
  undefined,
  undefined,
  unknown
>;
type RoleOption = { description: null | string; id: number; name: string };

interface AddUserFormCardProps {
  availablePeople: PersonWithExtras[];
  form: AddUserFormApi;
  handleLinkPerson: (personId: number | undefined) => void;
  isPeoplePermissionDenied: boolean;
  isRolesLoading: boolean;
  isSubmitPending: boolean;
  onCancel: () => void;
  roles: RoleOption[];
  showPageHeader: boolean;
}

function AddUserFormCard({
  availablePeople,
  form,
  handleLinkPerson,
  isPeoplePermissionDenied,
  isRolesLoading,
  isSubmitPending,
  onCancel,
  roles,
  showPageHeader,
}: AddUserFormCardProps) {
  return (
    <div className="mx-auto max-w-2xl space-y-8">
      {showPageHeader ? (
        <div className="space-y-2">
          <span className="block font-bold text-3xl text-primary">Agregar usuario</span>
          <Description className="text-default-600">
            Crea un nuevo usuario en el sistema. Se generará una contraseña temporal y el usuario
            deberá completar su configuración de seguridad al iniciar sesión.
          </Description>
        </div>
      ) : null}

      <form
        className="surface-elevated space-y-6 rounded-3xl p-6 shadow-lg"
        onSubmit={(e) => {
          e.preventDefault();
          e.stopPropagation();
          void form.handleSubmit();
        }}
      >
        {isPeoplePermissionDenied ? (
          <div className="rounded-xl border border-warning-soft-hover bg-warning/5 p-4 text-sm text-warning-700">
            No tienes permiso para ver personas existentes. Puedes crear el usuario sin vincularlo a
            una persona.
          </div>
        ) : null}

        <PersonLinkSection
          availablePeople={availablePeople}
          form={form}
          handleLinkPerson={handleLinkPerson}
        />
        <UserDataFields form={form} isRolesLoading={isRolesLoading} roles={roles} />
        <SecuritySection form={form} />

        <div className="flex justify-end gap-3 pt-4">
          <Button onPress={onCancel} type="button" variant="secondary">
            Cancelar
          </Button>
          <form.Subscribe selector={(state) => [state.isSubmitting]}>
            {([isSubmitting]) => (
              <Button className="gap-2" isDisabled={isSubmitting || isSubmitPending} type="submit">
                <UserPlus size={18} />
                {isSubmitting || isSubmitPending ? "Creando..." : "Crear usuario"}
              </Button>
            )}
          </form.Subscribe>
        </div>
      </form>
    </div>
  );
}

function PersonLinkSection({
  availablePeople,
  form,
  handleLinkPerson,
}: Pick<AddUserFormCardProps, "availablePeople" | "form" | "handleLinkPerson">) {
  const NONE_PERSON_KEY = "__none_person__";

  if (availablePeople.length === 0) {
    return null;
  }

  return (
    <div className="rounded-xl border border-info/20 bg-info/5 p-4">
      <div className="flex items-start gap-3">
        <Users className="mt-0.5 h-5 w-5 text-info" />
        <div className="flex-1 space-y-3">
          <div>
            <span className="block font-medium text-info">Vincular a persona existente</span>
            <Description className="text-default-600 text-xs">
              Si esta persona ya existe en el sistema, puedes vincular el usuario directamente.
            </Description>
          </div>
          <div className="space-y-2">
            <form.Field name="personId">
              {(field) => (
                <Select
                  onChange={(val) => {
                    const pid = val && val !== NONE_PERSON_KEY ? Number(val) : undefined;
                    handleLinkPerson(pid);
                  }}
                  value={field.state.value ? String(field.state.value) : NONE_PERSON_KEY}
                >
                  <Label>Vincular con persona (opcional)</Label>
                  <Select.Trigger>
                    <Select.Value />
                    <Select.Indicator />
                  </Select.Trigger>
                  <Select.Popover>
                    <ListBox>
                      <ListBox.Item
                        id={NONE_PERSON_KEY}
                        key={NONE_PERSON_KEY}
                        textValue="No vincular (Crear usuario nuevo)"
                      >
                        No vincular (Crear usuario nuevo)
                      </ListBox.Item>
                      {availablePeople.map((person) => (
                        <ListBox.Item
                          id={String(person.id)}
                          key={person.id}
                          textValue={getPersonFullName(person)}
                        >
                          {getPersonFullName(person)} - {person.rut}
                        </ListBox.Item>
                      ))}
                    </ListBox>
                  </Select.Popover>
                </Select>
              )}
            </form.Field>
          </div>
        </div>
      </div>
    </div>
  );
}

function UserDataFields({
  form,
  isRolesLoading,
  roles,
}: Pick<AddUserFormCardProps, "form" | "isRolesLoading" | "roles">) {
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <form.Subscribe selector={(state) => [state.values.personId]}>
        {([personId]) => {
          if (personId) {
            return null;
          }
          return (
            <>
              <div className="md:col-span-2">
                <span className="mb-4 block font-semibold text-foreground">Datos personales</span>
              </div>
              <form.Field name="names">
                {(field) => (
                  <TanStackInputField
                    field={field}
                    label="Nombres"
                    placeholder="Ej: Juan Andrés"
                    required
                  />
                )}
              </form.Field>
              <form.Field name="fatherName">
                {(field) => (
                  <TanStackInputField
                    field={field}
                    label="Primer apellido"
                    placeholder="Ej: Pérez"
                    required
                  />
                )}
              </form.Field>
              <form.Field name="motherName">
                {(field) => (
                  <TanStackInputField
                    field={field}
                    label="Segundo apellido"
                    placeholder="Ej: González"
                    required
                  />
                )}
              </form.Field>
              <form.Field name="rut">
                {(field) => (
                  <TanStackInputField
                    field={field}
                    label="RUT"
                    placeholder="12.345.678-9"
                    required
                  />
                )}
              </form.Field>
              <div className="md:col-span-1">{/* Spacer */}</div>
            </>
          );
        }}
      </form.Subscribe>

      <div className="md:col-span-2">
        <span className="mt-2 mb-4 block font-semibold text-foreground">Datos de cuenta</span>
      </div>

      <div className="md:col-span-2">
        <form.Field name="email">
          {(field) => (
            <form.Subscribe selector={(state) => [state.values.personId]}>
              {([personId]) => (
                <TanStackInputField
                  description={personId ? "Verifica o actualiza el correo asociado" : undefined}
                  field={field}
                  label="Correo electrónico"
                  placeholder="usuario@bioalergia.cl"
                  required
                  type="email"
                />
              )}
            </form.Subscribe>
          )}
        </form.Field>
      </div>

      <form.Field name="position">
        {(field) => (
          <TanStackInputField
            field={field}
            label="Cargo / posición"
            placeholder="Ej: Enfermera, Administrativo"
            required
          />
        )}
      </form.Field>

      <form.Subscribe selector={(state) => [state.values.personId]}>
        {([personId]) => (
          <div className={personId ? "md:col-span-2" : ""}>
            <form.Field name="role">
              {(field) => (
                <Select
                  isDisabled={isRolesLoading}
                  isInvalid={field.state.meta.errors.length > 0}
                  onChange={(val) => field.handleChange(val as string)}
                  placeholder={isRolesLoading ? "Cargando roles..." : "Seleccionar rol"}
                  value={field.state.value}
                >
                  <Label>Rol del sistema</Label>
                  <Select.Trigger>
                    <Select.Value />
                    <Select.Indicator />
                  </Select.Trigger>
                  <Select.Popover>
                    <ListBox>
                      {roles.map((r) => (
                        <ListBox.Item id={r.name} key={r.id} textValue={r.name}>
                          {r.name} ({r.description || "Sin descripción"})
                        </ListBox.Item>
                      ))}
                    </ListBox>
                  </Select.Popover>
                  {field.state.meta.errors.length > 0 && (
                    <FieldError>{field.state.meta.errors.join(", ")}</FieldError>
                  )}
                </Select>
              )}
            </form.Field>
          </div>
        )}
      </form.Subscribe>
    </div>
  );
}

function SecuritySection({ form }: Pick<AddUserFormCardProps, "form">) {
  return (
    <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
      <div className="flex items-start gap-3">
        <Shield className="mt-0.5 h-5 w-5 text-primary" />
        <div className="space-y-1">
          <span className="block font-medium text-primary">Seguridad reforzada</span>
          <Description className="text-default-600 text-xs">
            Si activas esta opción, el usuario estará <strong>obligado</strong> a configurar Passkey
            o MFA (Google Authenticator) antes de poder usar el sistema.
          </Description>
        </div>
      </div>
      <div className="mt-4 space-y-3 pl-8">
        <form.Field name="mfaEnforced">
          {(field) => (
            <Checkbox isSelected={field.state.value} onChange={field.handleChange}>
              <Checkbox.Control>
                <Checkbox.Indicator />
              </Checkbox.Control>
              Forzar passkey o MFA
            </Checkbox>
          )}
        </form.Field>
      </div>
    </div>
  );
}
