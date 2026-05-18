import {
  Alert,
  Button,
  Card,
  Checkbox,
  Input,
  Label,
  Skeleton,
  TextField,
} from "@heroui/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import { accountKeys } from "@/features/account/queries";
import { accountClient } from "@/lib/orpc-client";

type AddressFormState = {
  id?: number;
  label: string;
  street: string;
  number: string;
  supplement: string;
  reference: string;
  postalCode: string;
  comuna: string;
  region: string;
  isPrimary: boolean;
};

const emptyForm: AddressFormState = {
  label: "Principal",
  street: "",
  number: "",
  supplement: "",
  reference: "",
  postalCode: "",
  comuna: "",
  region: "",
  isPrimary: false,
};

function MiCuentaAddresses() {
  const queryClient = useQueryClient();
  const addresses = useQuery(accountKeys.addresses());
  const [form, setForm] = useState<AddressFormState>(emptyForm);
  const [editing, setEditing] = useState(false);

  const upsert = useMutation({
    mutationFn: () =>
      accountClient.upsertAddress({
        ...(form.id ? { id: form.id } : {}),
        label: form.label,
        street: form.street,
        number: form.number,
        ...(form.supplement ? { supplement: form.supplement } : {}),
        ...(form.reference ? { reference: form.reference } : {}),
        ...(form.postalCode ? { postalCode: form.postalCode } : {}),
        comuna: form.comuna,
        region: form.region,
        isPrimary: form.isPrimary,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: accountKeys.addresses().queryKey });
      setForm(emptyForm);
      setEditing(false);
    },
  });

  const remove = useMutation({
    mutationFn: (id: number) => accountClient.deleteAddress({ id }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: accountKeys.addresses().queryKey }),
  });

  function set<K extends keyof AddressFormState>(key: K, value: AddressFormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <div className="space-y-4">
      <header>
        <h1 className="font-bold text-2xl">Mis direcciones</h1>
      </header>

      {addresses.isLoading && <Skeleton className="h-24 w-full" />}
      <div className="space-y-2">
        {addresses.data?.data.map((addr) => (
          <Card key={addr.id}>
            <Card.Content className="flex items-start justify-between p-4">
              <div className="space-y-1">
                <p className="font-semibold text-sm">
                  {addr.label} {addr.is_primary && <span className="text-primary-700">(Principal)</span>}
                </p>
                <p className="text-default-500 text-sm">
                  {addr.street} {addr.number}
                  {addr.supplement && `, ${addr.supplement}`}
                </p>
                <p className="text-default-500 text-xs">
                  {addr.comuna}, {addr.region}
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  onPress={() => {
                    setForm({
                      id: addr.id,
                      label: addr.label,
                      street: addr.street,
                      number: addr.number,
                      supplement: addr.supplement ?? "",
                      reference: addr.reference ?? "",
                      postalCode: addr.postal_code ?? "",
                      comuna: addr.comuna,
                      region: addr.region,
                      isPrimary: addr.is_primary,
                    });
                    setEditing(true);
                  }}
                  size="sm"
                  variant="ghost"
                >
                  Editar
                </Button>
                <Button
                  isDisabled={remove.isPending}
                  onPress={() => remove.mutate(addr.id)}
                  size="sm"
                  variant="ghost"
                >
                  Eliminar
                </Button>
              </div>
            </Card.Content>
          </Card>
        ))}
      </div>

      {!editing && (
        <Button onPress={() => setEditing(true)} variant="secondary">
          Agregar dirección
        </Button>
      )}

      {editing && (
        <Card>
          <Card.Header>
            <Card.Title>{form.id ? "Editar dirección" : "Nueva dirección"}</Card.Title>
          </Card.Header>
          <Card.Content className="grid gap-3 sm:grid-cols-2">
            <TextField onChange={(v) => set("label", v)} value={form.label}>
              <Label>Alias</Label>
              <Input placeholder="Casa, Trabajo…" />
            </TextField>
            <TextField onChange={(v) => set("street", v)} value={form.street}>
              <Label>Calle</Label>
              <Input />
            </TextField>
            <TextField onChange={(v) => set("number", v)} value={form.number}>
              <Label>Número</Label>
              <Input />
            </TextField>
            <TextField onChange={(v) => set("supplement", v)} value={form.supplement}>
              <Label>Depto/Casa (opcional)</Label>
              <Input />
            </TextField>
            <TextField onChange={(v) => set("comuna", v)} value={form.comuna}>
              <Label>Comuna</Label>
              <Input />
            </TextField>
            <TextField onChange={(v) => set("region", v)} value={form.region}>
              <Label>Región</Label>
              <Input />
            </TextField>
            <TextField onChange={(v) => set("postalCode", v)} value={form.postalCode}>
              <Label>Código postal (opcional)</Label>
              <Input />
            </TextField>
            <TextField onChange={(v) => set("reference", v)} value={form.reference}>
              <Label>Referencia (opcional)</Label>
              <Input />
            </TextField>
            <Checkbox
              isSelected={form.isPrimary}
              onChange={(v) => set("isPrimary", v)}
            >
              Marcar como dirección principal
            </Checkbox>
            {upsert.isError && (
              <Alert status="danger">
                <Alert.Content>
                  <Alert.Description>
                    {upsert.error instanceof Error
                      ? upsert.error.message
                      : "No se pudo guardar"}
                  </Alert.Description>
                </Alert.Content>
              </Alert>
            )}
            <div className="col-span-full flex gap-2">
              <Button
                isDisabled={upsert.isPending}
                onPress={() => upsert.mutate()}
                variant="primary"
              >
                Guardar
              </Button>
              <Button
                onPress={() => {
                  setForm(emptyForm);
                  setEditing(false);
                }}
                variant="ghost"
              >
                Cancelar
              </Button>
            </div>
          </Card.Content>
        </Card>
      )}
    </div>
  );
}

export const Route = createFileRoute("/mi-cuenta/direcciones")({
  component: MiCuentaAddresses,
});
