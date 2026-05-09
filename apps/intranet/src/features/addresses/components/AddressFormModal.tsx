import type { Key } from "@heroui/react";
import {
  Button,
  Checkbox,
  Chip,
  ComboBox,
  Description,
  FieldError,
  Form,
  Input,
  Label,
  ListBox,
  Modal,
  Select,
  TextField,
} from "@heroui/react";
import { useForm, useStore } from "@tanstack/react-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Home, Save } from "lucide-react";
import { useEffect, useState } from "react";
import { useToast } from "@/context/ToastContext";
import {
  fetchCommunes,
  fetchRegions,
  getStreetNumbers,
  searchStreets,
} from "@/features/shipments/api";
import { createAddress, updateAddress } from "../api";

interface AddressFormState {
  label: string;
  street: string;
  number: string;
  supplement: string;
  reference: string;
  postalCode: string;
  region: Key | null; // Chilexpress regionId (e.g. "RM")
  comuna: Key | null; // Chilexpress countyCode (e.g. "LCON")
  isPrimary: boolean;
}

export interface AddressDraft {
  id?: number;
  label?: string;
  street?: string;
  number?: string;
  supplement?: null | string;
  reference?: null | string;
  postalCode?: null | string;
  regionCode?: null | string;
  coverageCode?: null | string;
  isPrimary?: boolean;
}

interface AddressFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  personId: number;
  draft?: AddressDraft; // when present → edit mode
}

export function AddressFormModal({
  isOpen,
  onClose,
  personId,
  draft,
}: Readonly<AddressFormModalProps>) {
  const queryClient = useQueryClient();
  const { error: toastError, success } = useToast();
  const isEditMode = Boolean(draft?.id);

  const { data: regionsResponse, isLoading: loadingRegions } = useQuery({
    queryKey: ["cx-regions"],
    queryFn: fetchRegions,
    staleTime: 1000 * 60 * 60,
  });
  const regions = regionsResponse?.regions ?? [];

  const form = useForm({
    defaultValues: {
      label: draft?.label ?? "Principal",
      street: draft?.street ?? "",
      number: draft?.number ?? "",
      supplement: draft?.supplement ?? "",
      reference: draft?.reference ?? "",
      postalCode: draft?.postalCode ?? "",
      region: (draft?.regionCode ?? null) as Key | null,
      comuna: (draft?.coverageCode ?? null) as Key | null,
      isPrimary: draft?.isPrimary ?? false,
    } as AddressFormState,
    onSubmit: async ({ value }) => {
      if (!value.region || !value.comuna) {
        toastError("Selecciona región y comuna");
        return;
      }
      const region = regions.find((r) => r.regionId === String(value.region));
      const regionDisplay = region?.regionName ?? String(value.region);
      const communes = await queryClient.fetchQuery({
        queryKey: ["cx-communes", String(value.region)],
        queryFn: () => fetchCommunes(String(value.region)),
        staleTime: 1000 * 60 * 60,
      });
      const communa = communes.communes.find((c) => c.coverageRegionCode === String(value.comuna));
      const comunaDisplay = communa?.countyName ?? String(value.comuna);

      const payload = {
        label: value.label || "Principal",
        street: value.street.trim(),
        number: value.number.trim(),
        supplement: value.supplement.trim() || null,
        reference: value.reference.trim() || null,
        postalCode: value.postalCode.trim() || null,
        region: regionDisplay,
        comuna: comunaDisplay,
        regionCode: String(value.region),
        coverageCode: String(value.comuna),
        ineRegionCode: (region as { ineRegionCode?: number } | undefined)?.ineRegionCode ?? null,
        ineCountyCode: communa?.ineCountyCode ?? null,
        supportsCashOnDelivery: communa?.supportsCashOnDelivery ?? null,
        supportsReturn: communa?.supportsReturn ?? null,
        isPrimary: value.isPrimary,
      };

      if (isEditMode && draft?.id) {
        await updateAddressMutation.mutateAsync({ id: draft.id, payload });
      } else {
        await createAddressMutation.mutateAsync({ ...payload, personId, countryCode: "CL" });
      }
    },
  });

  // Subscribe via form.useStore so outer queries (communes, sub-zones,
  // street lookup) re-fire when the user picks a region / comuna inside
  // a form.Field. Reading form.state directly only resolves once at
  // render and never reactively updates.
  const regionValue = useStore(form.store, (state) => String(state.values.region ?? ""));
  const comunaValue = useStore(form.store, (state) => String(state.values.comuna ?? ""));

  const { data: communesResponse, isLoading: loadingCommunes } = useQuery({
    queryKey: ["cx-communes", regionValue],
    queryFn: () => fetchCommunes(regionValue),
    enabled: regionValue.length > 0,
    staleTime: 1000 * 60 * 60,
  });
  const communes = communesResponse?.communes ?? [];

  const selectedCommuneName =
    communes.find((c) => c.coverageRegionCode === comunaValue)?.countyName ?? "";

  // Optional sub-sector picker (Chilexpress coverage type=2). When the
  // user is in a fringe sub-zone of a comuna (e.g. "BUIN - LINDEROS"),
  // selecting it overrides the comuna's coverageCode so Chilexpress
  // tarification matches the actual delivery area.
  const { data: subzonesData } = useQuery({
    queryKey: ["cx-communes-type2", regionValue],
    queryFn: () => fetchCommunes(regionValue, "2"),
    enabled: regionValue.length > 0,
    staleTime: 1000 * 60 * 60,
  });
  const allSubzones = subzonesData?.communes ?? [];
  const subzonesForCommune = allSubzones.filter(
    (s) => s.countyName === selectedCommuneName && s.coverageRegionCode !== comunaValue
  );

  const [pickedStreetId, setPickedStreetId] = useState<number | null>(null);

  const { data: streetNumbersData } = useQuery({
    queryKey: ["cx-street-numbers", pickedStreetId],
    queryFn: () => getStreetNumbers(pickedStreetId!),
    enabled: pickedStreetId != null,
    staleTime: 1000 * 60 * 30,
  });
  const validNumbers = (streetNumbersData?.numbers ?? []).map((n) => n.number);
  const minNumber = validNumbers.length ? Math.min(...validNumbers) : null;
  const maxNumber = validNumbers.length ? Math.max(...validNumbers) : null;

  const createAddressMutation = useMutation({
    mutationFn: createAddress,
    onError: (err) => toastError(err instanceof Error ? err.message : "Error al guardar dirección"),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["addresses", personId] });
      success("Dirección guardada");
      form.reset();
      onClose();
    },
  });

  const updateAddressMutation = useMutation({
    mutationFn: updateAddress,
    onError: (err) =>
      toastError(err instanceof Error ? err.message : "Error al actualizar dirección"),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["addresses", personId] });
      success("Dirección actualizada");
      form.reset();
      onClose();
    },
  });

  const isPending = createAddressMutation.isPending || updateAddressMutation.isPending;

  const handleClose = () => {
    if (isPending) return;
    form.reset();
    onClose();
  };

  return (
    <Modal>
      <Modal.Backdrop
        className="bg-black/40 backdrop-blur-[2px]"
        isOpen={isOpen}
        onOpenChange={(open) => {
          if (!open) handleClose();
        }}
      >
        <Modal.Container placement="center">
          <Modal.Dialog className="relative w-full max-w-2xl rounded-[28px] bg-background p-6 shadow-2xl">
            <Modal.Header className="mb-4 flex items-center gap-2 font-bold text-primary text-xl">
              <Home size={20} />
              <Modal.Heading>{isEditMode ? "Editar Dirección" : "Nueva Dirección"}</Modal.Heading>
            </Modal.Header>
            <Modal.Body className="mt-2 max-h-[70vh] overflow-y-auto overscroll-contain text-foreground">
              <Form
                className="space-y-4 pb-2"
                onSubmit={(e: React.FormEvent<HTMLFormElement>) => {
                  e.preventDefault();
                  e.stopPropagation();
                  void form.handleSubmit();
                }}
                validationBehavior="aria"
              >
                <form.Field name="label">
                  {(field) => (
                    <TextField
                      isRequired
                      onChange={(v) => field.handleChange(v)}
                      value={field.state.value}
                    >
                      <Label>Etiqueta</Label>
                      <Input placeholder="Casa, Trabajo, ..." />
                    </TextField>
                  )}
                </form.Field>

                {/* Cobertura primero: la búsqueda de calle depende de la
                    comuna, así que región + comuna se piden antes. */}
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <form.Field name="region">
                    {(field) => (
                      <Select
                        isDisabled={loadingRegions}
                        isRequired
                        onChange={(value) => {
                          field.handleChange(value as Key | null);
                          form.setFieldValue("comuna", null);
                        }}
                        placeholder="Selecciona una región"
                        value={field.state.value}
                      >
                        <Label>Región</Label>
                        <Select.Trigger>
                          <Select.Value />
                          <Select.Indicator />
                        </Select.Trigger>
                        <Select.Popover>
                          <ListBox>
                            {regions.map((r) => (
                              <ListBox.Item
                                id={r.regionId}
                                key={r.regionId}
                                textValue={r.regionName}
                              >
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
                        isRequired
                        onChange={(value) => field.handleChange(value as Key | null)}
                        placeholder="Selecciona una comuna"
                        value={field.state.value}
                      >
                        <Label>Comuna</Label>
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
                                  <span className="flex items-center gap-1">
                                    {!c.supportsCashOnDelivery && (
                                      <Chip color="warning" size="sm" variant="soft">
                                        Solo prepago
                                      </Chip>
                                    )}
                                    {!c.supportsReturn && (
                                      <Chip color="default" size="sm" variant="soft">
                                        Sin retorno
                                      </Chip>
                                    )}
                                  </span>
                                </span>
                                <ListBox.ItemIndicator />
                              </ListBox.Item>
                            ))}
                          </ListBox>
                        </Select.Popover>
                        <Description>
                          "Solo prepago" = comuna no acepta flete por cobrar (PPD); paga la clínica.
                          "Sin retorno" = no hay servicio de retorno de documentos.
                        </Description>
                      </Select>
                    )}
                  </form.Field>
                </div>

                {subzonesForCommune.length > 0 && (
                  <form.Field name="comuna">
                    {(field) => (
                      <Select
                        onChange={(value) => {
                          if (!value) return;
                          field.handleChange(value as Key);
                        }}
                        placeholder="Sin sub-sector específico"
                        value={field.state.value}
                      >
                        <Label>Sub-sector específico (opcional)</Label>
                        <Select.Trigger>
                          <Select.Value />
                          <Select.Indicator />
                        </Select.Trigger>
                        <Select.Popover>
                          <ListBox>
                            {subzonesForCommune.map((s) => (
                              <ListBox.Item
                                id={s.coverageRegionCode}
                                key={s.coverageRegionCode}
                                textValue={s.coverageName ?? s.countyName}
                              >
                                {s.coverageName ?? s.countyName}
                                <ListBox.ItemIndicator />
                              </ListBox.Item>
                            ))}
                          </ListBox>
                        </Select.Popover>
                      </Select>
                    )}
                  </form.Field>
                )}

                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
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
                      const num = Number(field.state.value);
                      const outOfRange =
                        validNumbers.length > 0 &&
                        Number.isFinite(num) &&
                        num > 0 &&
                        !validNumbers.includes(num);
                      return (
                        <TextField
                          isRequired
                          onChange={(v) => field.handleChange(v)}
                          value={field.state.value}
                        >
                          <Label>Número</Label>
                          <Input placeholder="1234" />
                          {minNumber != null && maxNumber != null ? (
                            <Description>
                              Rango Chilexpress: {minNumber} – {maxNumber}
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

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <form.Field name="postalCode">
                    {(field) => (
                      <TextField onChange={(v) => field.handleChange(v)} value={field.state.value}>
                        <Label>Código postal (opcional)</Label>
                        <Input placeholder="7550000" />
                      </TextField>
                    )}
                  </form.Field>
                  <form.Field name="reference">
                    {(field) => (
                      <TextField onChange={(v) => field.handleChange(v)} value={field.state.value}>
                        <Label>Referencia (opcional)</Label>
                        <Input placeholder="Frente a plaza, edificio azul..." />
                      </TextField>
                    )}
                  </form.Field>
                </div>

                <form.Field name="isPrimary">
                  {(field) => (
                    <Checkbox
                      isSelected={field.state.value}
                      onChange={(value) => field.handleChange(value)}
                    >
                      <Checkbox.Control>
                        <Checkbox.Indicator />
                      </Checkbox.Control>
                      <Checkbox.Content>
                        <Label>Marcar como dirección principal</Label>
                      </Checkbox.Content>
                    </Checkbox>
                  )}
                </form.Field>

                {form.state.errors.length > 0 ? (
                  <FieldError>{form.state.errors.join(", ")}</FieldError>
                ) : null}

                <div className="flex justify-end gap-3 border-default-100 border-t pt-4">
                  <Button
                    isDisabled={isPending}
                    onPress={handleClose}
                    type="button"
                    variant="ghost"
                  >
                    Cancelar
                  </Button>
                  <form.Subscribe selector={(state) => [state.canSubmit, state.isSubmitting]}>
                    {([canSubmit, isSubmitting]) => (
                      <Button
                        className="gap-2"
                        isDisabled={!canSubmit || isPending}
                        isPending={isSubmitting || isPending}
                        type="submit"
                      >
                        <Save size={16} />
                        {isEditMode ? "Actualizar" : "Guardar"}
                      </Button>
                    )}
                  </form.Subscribe>
                </div>
              </Form>
            </Modal.Body>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
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
  // Local input separate from form value so user typing does not commit
  // partial text until they pick a suggestion (or type custom value).
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
    queryKey: ["cx-streets", countyName, debounced],
    queryFn: () => searchStreets({ countyName, query: debounced }),
    enabled: countyName.length > 0 && debounced.trim().length >= 2,
    staleTime: 1000 * 60 * 10,
  });
  const streets = streetsResponse?.streets ?? [];

  return (
    <ComboBox
      allowsCustomValue
      inputValue={inputValue}
      isDisabled={countyName.length === 0}
      items={streets}
      menuTrigger="input"
      onInputChange={(next) => {
        setInputValue(next);
        onChange(next);
      }}
      onSelectionChange={(key) => {
        if (key == null) return;
        const street = streets.find((s) => String(s.streetId) === String(key));
        if (street) {
          setInputValue(street.streetName);
          onChange(street.streetName);
          onSelectStreet?.(street.streetId, street.streetName);
        }
      }}
    >
      <Label>Calle</Label>
      <ComboBox.InputGroup>
        <Input placeholder={countyName ? "Av. Apoquindo" : "Selecciona una comuna primero"} />
        <ComboBox.Trigger />
      </ComboBox.InputGroup>
      <ComboBox.Popover>
        <ListBox>
          {isLoading ? (
            <ListBox.Item id="__loading__" textValue="Buscando...">
              Buscando...
            </ListBox.Item>
          ) : streets.length === 0 ? (
            <ListBox.Item id="__empty__" textValue="Sin sugerencias">
              {debounced.length < 2
                ? "Escribe al menos 2 caracteres"
                : "Sin sugerencias para esta comuna"}
            </ListBox.Item>
          ) : (
            streets.map((s) => (
              <ListBox.Item id={String(s.streetId)} key={s.streetId} textValue={s.streetName}>
                {s.streetName}
              </ListBox.Item>
            ))
          )}
        </ListBox>
      </ComboBox.Popover>
    </ComboBox>
  );
}
