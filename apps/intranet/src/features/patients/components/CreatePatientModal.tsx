import type { Key } from "@heroui/react";
import type { DateValue } from "@internationalized/date";
import {
  Button,
  Calendar,
  Chip,
  DateField,
  DatePicker,
  Form,
  Label,
  ListBox,
  Select,
  Input,
  TextField,
  ComboBox,
  Description,
} from "@heroui/react";
import { useForm, useStore } from "@tanstack/react-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, OctagonX, Save, User, UserPlus } from "lucide-react";
import { useEffect, useState, useMemo } from "react";
import {
  TanStackInputField,
  TanStackTextAreaField,
} from "@/components/forms/TanStackFieldControls";
import { AppModal } from "@/components/ui/AppModal";
import { FeatureErrorBoundary } from "@/components/ui/FeatureErrorBoundary";
import { useToast } from "@/context/ToastContext";
import { createPatient } from "@/features/patients/api";
import { patientKeys, patientQueries } from "@/features/patients/queries";
import { formatRut, validateRut } from "@/lib/rut";
import {
  fetchCommunes,
  fetchRegions,
  getStreetNumbers,
  searchStreets,
} from "@/features/shipments/api";
import { createAddress } from "@/features/addresses/api";
import { cxKeys } from "@/features/addresses/queries";

const BLOOD_TYPES = ["O+", "O-", "A+", "A-", "B+", "B-", "AB+", "AB-"];

interface PatientFormState {
  rut: string;
  names: string;
  fatherName: string;
  motherName: string;
  email: string;
  phone: string;
  birthDate: DateValue | null;
  bloodType: string;
  sex: string;
  notes: string;
  // Address fields
  region: Key | null;
  comuna: Key | null;
  street: string;
  number: string;
  supplement: string;
}

type PatientPayload = Omit<
  PatientFormState,
  "birthDate" | "sex" | "region" | "comuna" | "street" | "number" | "supplement"
> & {
  birthDate?: string;
  sex?: "M" | "F" | "X";
};

interface CreatePatientModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface StreetAutocompleteProps {
  countyName: string;
  value: string;
  onChange: (value: string) => void;
  onSelectStreet?: (streetId: number, streetName: string) => void;
}

function StreetAutocomplete({
  countyName,
  value,
  onChange,
  onSelectStreet,
}: Readonly<StreetAutocompleteProps>) {
  const [inputValue, setInputValue] = useState(value);
  const [debounced, setDebounced] = useState(inputValue);

  useEffect(() => {
    setInputValue(value);
  }, [value]);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(inputValue), 300);
    return () => clearTimeout(t);
  }, [inputValue]);

  const { data: streetsResponse, isLoading } = useQuery({
    queryKey: cxKeys.streets(countyName, debounced),
    queryFn: () => searchStreets({ countyName, query: debounced }),
    enabled: countyName.length > 0 && debounced.trim().length >= 2,
    staleTime: 1000 * 60 * 10,
  });
  const streets = useMemo(() => streetsResponse?.streets ?? [], [streetsResponse]);

  type StreetRow =
    | { kind: "street"; id: string; label: string; streetId: number }
    | { kind: "placeholder"; id: string; label: string };

  const { items, disabledIds } = useMemo<{
    items: StreetRow[];
    disabledIds: string[];
  }>(() => {
    if (countyName.length === 0) {
      return {
        items: [
          { kind: "placeholder", id: "__no-county__", label: "Selecciona una comuna primero" },
        ],
        disabledIds: ["__no-county__"],
      };
    }
    if (debounced.trim().length < 2) {
      return {
        items: [
          { kind: "placeholder", id: "__too-short__", label: "Escribe al menos 2 caracteres" },
        ],
        disabledIds: ["__too-short__"],
      };
    }
    if (isLoading) {
      return {
        items: [{ kind: "placeholder", id: "__loading__", label: "Buscando…" }],
        disabledIds: ["__loading__"],
      };
    }
    if (streets.length === 0) {
      return {
        items: [
          { kind: "placeholder", id: "__empty__", label: "Sin sugerencias para esta comuna" },
        ],
        disabledIds: ["__empty__"],
      };
    }
    return {
      items: streets.map((s) => ({
        kind: "street" as const,
        id: `s-${s.streetId}`,
        label: s.streetName,
        streetId: s.streetId,
      })),
      disabledIds: [],
    };
  }, [countyName, debounced, isLoading, streets]);

  return (
    <ComboBox
      allowsCustomValue
      inputValue={inputValue}
      isDisabled={countyName.length === 0}
      items={items}
      menuTrigger="input"
      onInputChange={(next) => {
        setInputValue(next);
        onChange(next);
      }}
      onSelectionChange={(key) => {
        if (key == null) return;
        const row = items.find((i) => i.id === String(key));
        if (row && row.kind === "street") {
          setInputValue(row.label);
          onChange(row.label);
          onSelectStreet?.(row.streetId, row.label);
        }
      }}
    >
      <Label>Calle</Label>
      <ComboBox.InputGroup>
        <Input placeholder={countyName ? "Av. Apoquindo" : "Selecciona una comuna primero"} />
        <ComboBox.Trigger />
      </ComboBox.InputGroup>
      <ComboBox.Popover>
        <ListBox disabledKeys={disabledIds}>
          {(item: StreetRow) => (
            <ListBox.Item id={item.id} textValue={item.label}>
              {item.label}
            </ListBox.Item>
          )}
        </ListBox>
      </ComboBox.Popover>
    </ComboBox>
  );
}

export function CreatePatientModal({ isOpen, onClose }: Readonly<CreatePatientModalProps>) {
  const queryClient = useQueryClient();
  const { error: toastError, success } = useToast();

  const { data: regionsResponse, isLoading: loadingRegions } = useQuery({
    queryKey: cxKeys.regions,
    queryFn: fetchRegions,
    staleTime: 1000 * 60 * 60,
  });
  const regions = regionsResponse?.regions ?? [];

  const createPatientMutation = useMutation({
    mutationFn: async (payload: PatientPayload) => createPatient(payload),
    onError: (err) => {
      toastError(err instanceof Error ? err.message : "Error al registrar paciente");
    },
  });

  const createAddressMutation = useMutation({
    mutationFn: createAddress,
    onError: (err) => {
      toastError(
        err instanceof Error
          ? err.message
          : "Error al guardar dirección. Puedes agregarla luego en el perfil."
      );
    },
  });

  const [pickedStreetId, setPickedStreetId] = useState<number | null>(null);

  const form = useForm({
    defaultValues: {
      rut: "",
      names: "",
      fatherName: "",
      motherName: "",
      email: "",
      phone: "",
      birthDate: null,
      bloodType: "",
      sex: "",
      notes: "",
      region: null,
      comuna: null,
      street: "",
      number: "",
      supplement: "",
    } as PatientFormState,
    onSubmit: async ({ value }) => {
      if (!validateRut(value.rut)) {
        toastError("El RUT ingresado no es válido");
        return;
      }

      try {
        const newPatient = await createPatientMutation.mutateAsync({
          rut: value.rut,
          names: value.names,
          fatherName: value.fatherName,
          motherName: value.motherName,
          email: value.email,
          phone: value.phone,
          bloodType: value.bloodType,
          notes: value.notes,
          birthDate: value.birthDate?.toString() ?? undefined,
          sex: value.sex ? (value.sex as "M" | "F" | "X") : undefined,
        });

        // Try to create address if minimum fields are present
        if (value.region && value.comuna && value.street) {
          const regionObj = regions.find((r) => r.regionId === String(value.region));
          const regionDisplay = regionObj?.regionName ?? String(value.region);

          const communes = await queryClient.fetchQuery({
            queryKey: cxKeys.communes(String(value.region)),
            queryFn: () => fetchCommunes(String(value.region)),
            staleTime: 1000 * 60 * 60,
          });
          const communaObj = communes.communes.find(
            (c) => c.coverageRegionCode === String(value.comuna)
          );
          const comunaDisplay = communaObj?.countyName ?? String(value.comuna);

          await createAddressMutation.mutateAsync({
            label: "Principal",
            street: value.street.trim(),
            number: value.number.trim(),
            supplement: value.supplement.trim() || null,
            reference: null,
            postalCode: null,
            region: regionDisplay,
            comuna: comunaDisplay,
            regionCode: String(value.region),
            coverageCode: String(value.comuna),
            ineRegionCode:
              (regionObj as { ineRegionCode?: number } | undefined)?.ineRegionCode ?? null,
            ineCountyCode: communaObj?.ineCountyCode ?? null,
            supportsCashOnDelivery: communaObj?.supportsCashOnDelivery ?? null,
            supportsReturn: communaObj?.supportsReturn ?? null,
            isPrimary: true,
            personId: newPatient.personId,
            countryCode: "CL",
          });
        }

        void queryClient.invalidateQueries({ queryKey: patientKeys.all });
        success("Paciente registrado exitosamente");
        form.reset();
        onClose();
      } catch (err) {
        // Error handled in mutation onError
      }
    },
  });

  const handleClose = () => {
    if (createPatientMutation.isPending || createAddressMutation.isPending) {
      return;
    }
    form.reset();
    onClose();
  };

  const rutValue = useStore(form.store, (s) => s.values.rut);
  const nameValue = useStore(form.store, (s) => s.values.names);
  const regionValue = useStore(form.store, (s) => String(s.values.region ?? ""));
  const comunaValue = useStore(form.store, (s) => String(s.values.comuna ?? ""));

  const [debouncedRut, setDebouncedRut] = useState("");
  const [debouncedName, setDebouncedName] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setDebouncedRut(rutValue), 400);
    return () => clearTimeout(t);
  }, [rutValue]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedName(nameValue), 500);
    return () => clearTimeout(t);
  }, [nameValue]);

  const { data: existingPerson } = useQuery({
    ...patientQueries.personByRut(debouncedRut),
    enabled: validateRut(debouncedRut),
  });

  const hasExistingPatient = Boolean(
    (existingPerson as { patient?: unknown } | null | undefined)?.patient
  );

  const { data: nameMatches } = useQuery({
    ...patientQueries.nameSearch(debouncedName),
    enabled: debouncedName.trim().length >= 3,
  });

  const similarByName = nameMatches?.filter((p) => p.person.id !== existingPerson?.id) ?? [];

  const linkExistingPerson = () => {
    if (!existingPerson) return;
    if (existingPerson.names) form.setFieldValue("names", existingPerson.names);
    if (existingPerson.fatherName) form.setFieldValue("fatherName", existingPerson.fatherName);
    if (existingPerson.motherName) form.setFieldValue("motherName", existingPerson.motherName);
    if (existingPerson.email) form.setFieldValue("email", existingPerson.email);
    if (existingPerson.phone) form.setFieldValue("phone", existingPerson.phone);
  };

  const { data: communesResponse, isLoading: loadingCommunes } = useQuery({
    queryKey: cxKeys.communes(regionValue),
    queryFn: () => fetchCommunes(regionValue),
    enabled: regionValue.length > 0,
    staleTime: 1000 * 60 * 60,
  });
  const communes = communesResponse?.communes ?? [];
  const selectedCommuneName =
    communes.find((c) => c.coverageRegionCode === comunaValue)?.countyName ?? "";

  const { data: streetNumbersData } = useQuery({
    queryKey: cxKeys.streetNumbers(pickedStreetId),
    queryFn: () => getStreetNumbers(pickedStreetId as number),
    enabled: pickedStreetId != null,
    staleTime: 1000 * 60 * 30,
  });
  const validNumbers = (streetNumbersData?.numbers ?? []).map((n) => n.number);
  const minNumber = validNumbers.length ? Math.min(...validNumbers) : null;
  const maxNumber = validNumbers.length ? Math.max(...validNumbers) : null;

  return (
    <AppModal
      isOpen={isOpen}
      onClose={handleClose}
      title="Registrar Nuevo Paciente"
      size="lg"
      footer={
        <>
          <Button
            isDisabled={createPatientMutation.isPending || createAddressMutation.isPending}
            onPress={handleClose}
            type="button"
            variant="outline"
          >
            Cancelar
          </Button>
          <form.Subscribe selector={(state) => [state.canSubmit, state.isSubmitting]}>
            {([canSubmit, isSubmitting]) => (
              <Button
                className="min-w-37.5"
                form="create-patient-form"
                isDisabled={
                  !canSubmit ||
                  createPatientMutation.isPending ||
                  hasExistingPatient ||
                  createAddressMutation.isPending
                }
                isPending={
                  isSubmitting || createPatientMutation.isPending || createAddressMutation.isPending
                }
                type="submit"
                variant="primary"
              >
                Registrar Paciente
              </Button>
            )}
          </form.Subscribe>
        </>
      }
    >
      <FeatureErrorBoundary featureName="Crear Paciente" onClose={onClose}>
        <Form
          id="create-patient-form"
          className="space-y-6 pb-2"
          onSubmit={(e: React.FormEvent<HTMLFormElement>) => {
            e.preventDefault();
            e.stopPropagation();
            void form.handleSubmit();
          }}
          validationBehavior="aria"
        >
          <div className="space-y-4">
            <div className="flex items-center gap-2 border-default-100 border-b pb-2 font-semibold text-primary">
              <UserPlus size={18} />
              <h3>Informacion Personal</h3>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <form.Field
                name="rut"
                validators={{
                  onBlur: ({ value }) =>
                    value && !validateRut(value) ? "RUT inválido" : undefined,
                }}
              >
                {(field) => (
                  <TanStackInputField
                    field={field}
                    label="RUT"
                    placeholder="12.345.678-9"
                    required
                    transformOnChange={formatRut}
                  />
                )}
              </form.Field>

              <form.Field name="names">
                {(field) => (
                  <TanStackInputField
                    field={field}
                    label="Nombres"
                    placeholder="Ej: Juan Andres"
                    required
                  />
                )}
              </form.Field>

              <form.Field name="fatherName">
                {(field) => (
                  <TanStackInputField
                    field={field}
                    label="Primer apellido"
                    placeholder="Ej: Perez"
                    required
                  />
                )}
              </form.Field>

              <form.Field name="motherName">
                {(field) => (
                  <TanStackInputField
                    field={field}
                    label="Segundo apellido"
                    placeholder="Ej: Gonzalez"
                    required
                  />
                )}
              </form.Field>

              <form.Field name="birthDate">
                {(field) => (
                  <DatePicker
                    onChange={(value) => field.handleChange(value)}
                    value={field.state.value}
                  >
                    <Label>Fecha de Nacimiento</Label>
                    <DateField.Group>
                      <DateField.InputContainer>
                        <DateField.Input>
                          {(segment) => <DateField.Segment segment={segment} />}
                        </DateField.Input>
                      </DateField.InputContainer>
                      <DateField.Suffix>
                        <DatePicker.Trigger>
                          <DatePicker.TriggerIndicator />
                        </DatePicker.Trigger>
                      </DateField.Suffix>
                    </DateField.Group>
                    <DatePicker.Popover>
                      <Calendar aria-label="Fecha de nacimiento">
                        <Calendar.Header>
                          <Calendar.YearPickerTrigger>
                            <Calendar.YearPickerTriggerHeading />
                            <Calendar.YearPickerTriggerIndicator />
                          </Calendar.YearPickerTrigger>
                          <Calendar.NavButton slot="previous" />
                          <Calendar.NavButton slot="next" />
                        </Calendar.Header>
                        <Calendar.Grid>
                          <Calendar.GridHeader>
                            {(day) => <Calendar.HeaderCell>{day}</Calendar.HeaderCell>}
                          </Calendar.GridHeader>
                          <Calendar.GridBody>
                            {(date) => <Calendar.Cell date={date} />}
                          </Calendar.GridBody>
                        </Calendar.Grid>
                        <Calendar.YearPickerGrid>
                          <Calendar.YearPickerGridBody>
                            {({ year }) => <Calendar.YearPickerCell year={year} />}
                          </Calendar.YearPickerGridBody>
                        </Calendar.YearPickerGrid>
                      </Calendar>
                    </DatePicker.Popover>
                  </DatePicker>
                )}
              </form.Field>

              <form.Field name="sex">
                {(field) => (
                  <Select
                    onChange={(val) =>
                      field.handleChange(val === "__no_sex__" ? "" : (val as string))
                    }
                    value={field.state.value || "__no_sex__"}
                  >
                    <Label>Sexo</Label>
                    <Select.Trigger>
                      <Select.Value />
                      <Select.Indicator />
                    </Select.Trigger>
                    <Select.Popover>
                      <ListBox>
                        <ListBox.Item id="__no_sex__" key="__no_sex__">
                          Sin especificar
                        </ListBox.Item>
                        <ListBox.Item id="M" key="M">
                          Masculino
                        </ListBox.Item>
                        <ListBox.Item id="F" key="F">
                          Femenino
                        </ListBox.Item>
                        <ListBox.Item id="X" key="X">
                          Otro / Indeterminado
                        </ListBox.Item>
                      </ListBox>
                    </Select.Popover>
                  </Select>
                )}
              </form.Field>

              <form.Field name="bloodType">
                {(field) => (
                  <Select
                    onChange={(val) =>
                      field.handleChange(val === "__unknown_blood_type__" ? "" : (val as string))
                    }
                    value={field.state.value || "__unknown_blood_type__"}
                  >
                    <Label>Grupo Sanguineo</Label>
                    <Select.Trigger>
                      <Select.Value />
                      <Select.Indicator />
                    </Select.Trigger>
                    <Select.Popover>
                      <ListBox>
                        <ListBox.Item id="__unknown_blood_type__" key="__unknown_blood_type__">
                          Desconocido
                        </ListBox.Item>
                        {BLOOD_TYPES.map((type) => (
                          <ListBox.Item id={type} key={type}>
                            {type}
                          </ListBox.Item>
                        ))}
                      </ListBox>
                    </Select.Popover>
                  </Select>
                )}
              </form.Field>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center gap-2 border-default-100 border-b pb-2 font-semibold text-primary">
              <User size={18} />
              <h3>Contacto y Ubicacion</h3>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <form.Field name="email">
                {(field) => (
                  <TanStackInputField
                    field={field}
                    label="Correo Electronico"
                    placeholder="paciente@ejemplo.com"
                    type="email"
                  />
                )}
              </form.Field>

              <form.Field name="phone">
                {(field) => (
                  <TanStackInputField
                    field={field}
                    label="Telefono"
                    placeholder="+56 9 1234 5678"
                  />
                )}
              </form.Field>

              {/* Added Address Fields to unify with Shipments/Pulpo */}
              <form.Field name="region">
                {(field) => (
                  <Select
                    isDisabled={loadingRegions}
                    onChange={(value) => {
                      field.handleChange(value as Key | null);
                      form.setFieldValue("comuna", null);
                    }}
                    placeholder="Selecciona una región"
                    value={field.state.value}
                  >
                    <Label>Región (opcional)</Label>
                    <Select.Trigger>
                      <Select.Value />
                      <Select.Indicator />
                    </Select.Trigger>
                    <Select.Popover>
                      <ListBox>
                        {regions.map((r) => (
                          <ListBox.Item id={r.regionId} key={r.regionId} textValue={r.regionName}>
                            {r.regionName}
                            <ListBox.ItemIndicator />
                          </ListBox.Item>
                        ))}
                      </ListBox>
                    </Select.Popover>
                  </Select>
                )}
              </form.Field>

              <form.Field name="comuna">
                {(field) => (
                  <Select
                    isDisabled={!regionValue || loadingCommunes}
                    onChange={(value) => field.handleChange(value as Key | null)}
                    placeholder="Selecciona una comuna"
                    value={field.state.value}
                  >
                    <Label>Comuna (opcional)</Label>
                    <Select.Trigger>
                      <Select.Value />
                      <Select.Indicator />
                    </Select.Trigger>
                    <Select.Popover>
                      <ListBox>
                        {communes.map((c) => (
                          <ListBox.Item
                            id={c.coverageRegionCode}
                            key={c.coverageRegionCode}
                            textValue={c.countyName}
                          >
                            <span className="flex w-full items-center justify-between gap-2">
                              <span>{c.countyName}</span>
                            </span>
                            <ListBox.ItemIndicator />
                          </ListBox.Item>
                        ))}
                      </ListBox>
                    </Select.Popover>
                  </Select>
                )}
              </form.Field>

              <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2">
                  <form.Field name="street">
                    {(field) => (
                      <StreetAutocomplete
                        countyName={selectedCommuneName}
                        onChange={(value) => {
                          field.handleChange(value);
                          setPickedStreetId(null);
                        }}
                        onSelectStreet={(streetId) => setPickedStreetId(streetId)}
                        value={field.state.value}
                      />
                    )}
                  </form.Field>
                </div>

                <form.Field name="number">
                  {(field) => {
                    const raw = field.state.value;
                    const num = Number(raw);
                    const outOfRange =
                      validNumbers.length > 0 &&
                      Number.isFinite(num) &&
                      num > 0 &&
                      !validNumbers.includes(num);
                    const nonNumeric = raw.trim() !== "" && !/^\d+$/.test(raw.trim());
                    return (
                      <TextField onChange={(v) => field.handleChange(v)} value={field.state.value}>
                        <Label>Número</Label>
                        <Input placeholder="1234" inputMode="numeric" />
                        {minNumber != null && maxNumber != null ? (
                          <Description>
                            Rango Chilexpress: {minNumber} – {maxNumber}
                          </Description>
                        ) : null}
                        {nonNumeric ? (
                          <Description className="text-danger">
                            Solo dígitos (Chilexpress rechaza letras)
                          </Description>
                        ) : null}
                        {outOfRange ? (
                          <Description className="text-warning">
                            Número fuera del rango registrado
                          </Description>
                        ) : null}
                      </TextField>
                    );
                  }}
                </form.Field>
              </div>

              <form.Field name="supplement">
                {(field) => (
                  <TextField onChange={(v) => field.handleChange(v)} value={field.state.value}>
                    <Label>Depto / Casa (opcional)</Label>
                    <Input placeholder="Depto 502, Casa 5, etc." />
                  </TextField>
                )}
              </form.Field>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center gap-2 border-default-100 border-b pb-2 font-semibold text-primary">
              <Save size={18} />
              <h3>Informacion Adicional</h3>
            </div>
            <form.Field name="notes">
              {(field) => (
                <TanStackTextAreaField
                  field={field}
                  className="h-28"
                  label="Notas clinicas / Antecedentes"
                  placeholder="Ingrese cualquier antecedente relevante o notas generales..."
                />
              )}
            </form.Field>
          </div>

          {hasExistingPatient && existingPerson && (
            <div className="flex items-start gap-2 rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-danger text-sm">
              <OctagonX size={16} className="mt-0.5 shrink-0" />
              <div>
                <p className="font-semibold">Paciente ya registrado</p>
                <p className="text-xs">
                  Ya existe un perfil de paciente para{" "}
                  <span className="font-medium">
                    {existingPerson.names} {existingPerson.fatherName ?? ""}
                  </span>{" "}
                  — {existingPerson.rut}
                </p>
              </div>
            </div>
          )}

          {!hasExistingPatient && existingPerson && (
            <div className="flex items-start justify-between gap-3 rounded-xl border border-accent/30 bg-accent/10 px-4 py-3 text-sm">
              <div className="flex items-start gap-2">
                <User size={16} className="mt-0.5 shrink-0 text-accent" />
                <div>
                  <p className="font-semibold text-accent">Esta persona ya existe en el sistema</p>
                  <p className="text-default-600 text-xs">
                    {existingPerson.names} {existingPerson.fatherName ?? ""}{" "}
                    {existingPerson.motherName ?? ""}
                    {existingPerson.hasEmployee ? " · empleado" : ""}
                    {existingPerson.hasUser ? " · usuario" : ""}. Se enlazará el perfil de paciente
                    a este registro existente.
                  </p>
                </div>
              </div>
              <Button onPress={linkExistingPerson} size="sm" variant="secondary">
                Rellenar datos
              </Button>
            </div>
          )}

          {!hasExistingPatient && similarByName.length > 0 && (
            <div className="rounded-xl border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning-700 dark:text-warning-300">
              <div className="mb-2 flex items-center gap-2 font-semibold">
                <AlertTriangle size={15} />
                Pacientes similares encontrados
              </div>
              <ul className="space-y-1">
                {similarByName.slice(0, 3).map((p) => (
                  <li key={p.id} className="flex items-center gap-2 text-xs">
                    <Chip size="sm" variant="soft" color="warning">
                      {p.person.rut}
                    </Chip>
                    {p.person.names} {p.person.fatherName}
                    {p.person.phone && <span className="text-default-500">· {p.person.phone}</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Form>
      </FeatureErrorBoundary>
    </AppModal>
  );
}
