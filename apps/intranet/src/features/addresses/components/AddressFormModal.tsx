import type { Key } from "@heroui/react";
import {
  Button,
  Checkbox,
  FieldError,
  Form,
  Input,
  Label,
  ListBox,
  Modal,
  Select,
  TextField,
} from "@heroui/react";
import { useForm } from "@tanstack/react-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Home, Save } from "lucide-react";
import { useToast } from "@/context/ToastContext";
import { fetchCommunes, fetchRegions } from "@/features/shipments/api";
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
      const regionDisplay =
        regions.find((r) => r.regionId === String(value.region))?.regionName ??
        String(value.region);
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
        isPrimary: value.isPrimary,
      };

      if (isEditMode && draft?.id) {
        await updateAddressMutation.mutateAsync({ id: draft.id, payload });
      } else {
        await createAddressMutation.mutateAsync({ ...payload, personId, countryCode: "CL" });
      }
    },
  });

  const regionValue = String(form.state.values.region ?? "");

  const { data: communesResponse, isLoading: loadingCommunes } = useQuery({
    queryKey: ["cx-communes", regionValue],
    queryFn: () => fetchCommunes(regionValue),
    enabled: regionValue.length > 0,
    staleTime: 1000 * 60 * 60,
  });
  const communes = communesResponse?.communes ?? [];

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

                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  <div className="md:col-span-2">
                    <form.Field name="street">
                      {(field) => (
                        <TextField
                          isRequired
                          onChange={(v) => field.handleChange(v)}
                          value={field.state.value}
                        >
                          <Label>Calle</Label>
                          <Input placeholder="Av. Apoquindo" />
                        </TextField>
                      )}
                    </form.Field>
                  </div>
                  <form.Field name="number">
                    {(field) => (
                      <TextField
                        isRequired
                        onChange={(v) => field.handleChange(v)}
                        value={field.state.value}
                      >
                        <Label>Número</Label>
                        <Input placeholder="1234" />
                      </TextField>
                    )}
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
                                {c.countyName}
                                <ListBox.ItemIndicator />
                              </ListBox.Item>
                            ))}
                          </ListBox>
                        </Select.Popover>
                      </Select>
                    )}
                  </form.Field>
                </div>

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
                      <Checkbox.Indicator />
                      <Label>Marcar como dirección principal</Label>
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
