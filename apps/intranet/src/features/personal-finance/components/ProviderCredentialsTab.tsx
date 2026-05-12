import {
  Button,
  Chip,
  Input,
  Label,
  ListBox,
  Modal,
  Select,
  TextArea,
  TextField,
} from "@heroui/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";
import { PencilIcon, PlugIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { useState } from "react";

import type {
  ProviderAuthMethod,
  ProviderKind,
} from "@finanzas/orpc-contracts/provider-credentials";
import { toast } from "@/lib/toast-interceptor";

import {
  providerCredentialsClient,
  toProviderCredentialsError,
} from "../provider-credentials-orpc";

interface FormState {
  authMethod: ProviderAuthMethod;
  identifier: string;
  isActive: boolean;
  label: string;
  notes: string;
  provider: ProviderKind;
  scope: "BIOALERGIA" | "PERSONAL";
  secret: string;
}

const PROVIDERS: { label: string; value: ProviderKind }[] = [
  { label: "Movistar", value: "MOVISTAR" },
  { label: "Telsur / GTD", value: "TELSUR" },
  { label: "Doctoralia", value: "DOCTORALIA" },
  { label: "Medipass (ex-IMED)", value: "MEDIPASS" },
  { label: "Isapre MasVida", value: "MASVIDA" },
  { label: "Previred", value: "PREVIRED" },
  { label: "SII", value: "SII" },
  { label: "TGR", value: "TGR" },
  { label: "Gastos Comunes", value: "GASTOS_COMUNES" },
  { label: "Otro", value: "OTHER" },
];

const AUTH_METHODS: { label: string; value: ProviderAuthMethod }[] = [
  { label: "RUT + contraseña", value: "RUT_PASSWORD" },
  { label: "Clave única", value: "CLAVE_UNICA" },
  { label: "Clave tributaria SII", value: "CLAVE_TRIBUTARIA" },
  { label: "OAuth", value: "OAUTH" },
  { label: "API Key", value: "API_KEY" },
  { label: "Forward por email", value: "EMAIL_FORWARDING" },
  { label: "Público (sin auth)", value: "NONE_PUBLIC" },
];

const DEFAULT_FORM: FormState = {
  authMethod: "RUT_PASSWORD",
  identifier: "",
  isActive: true,
  label: "",
  notes: "",
  provider: "MOVISTAR",
  scope: "PERSONAL",
  secret: "",
};

export function ProviderCredentialsTab() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<null | number>(null);
  const [form, setForm] = useState<FormState>(DEFAULT_FORM);

  const listQuery = useQuery({
    queryFn: () => providerCredentialsClient.list({}),
    queryKey: ["provider-credentials"],
  });

  const createMutation = useMutation({
    mutationFn: () => providerCredentialsClient.create(form),
    onError: (err) => toast.error(toProviderCredentialsError(err).message),
    onSuccess: () => {
      toast.success("Credencial guardada");
      void queryClient.invalidateQueries({ queryKey: ["provider-credentials"] });
      reset();
    },
  });

  const updateMutation = useMutation({
    mutationFn: () => {
      if (editingId === null) {
        throw new Error("No credential selected to update");
      }
      return providerCredentialsClient.update({
        id: editingId,
        payload: {
          authMethod: form.authMethod,
          identifier: form.identifier,
          isActive: form.isActive,
          label: form.label || null,
          notes: form.notes || null,
          provider: form.provider,
          scope: form.scope,
          ...(form.secret ? { secret: form.secret } : {}),
        },
      });
    },
    onError: (err) => toast.error(toProviderCredentialsError(err).message),
    onSuccess: () => {
      toast.success("Credencial actualizada");
      void queryClient.invalidateQueries({ queryKey: ["provider-credentials"] });
      reset();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => providerCredentialsClient.delete({ id }),
    onError: (err) => toast.error(toProviderCredentialsError(err).message),
    onSuccess: () => {
      toast.success("Credencial eliminada");
      void queryClient.invalidateQueries({ queryKey: ["provider-credentials"] });
    },
  });

  const testMutation = useMutation({
    mutationFn: (id: number) => providerCredentialsClient.test({ id }),
    onError: (err) => toast.error(toProviderCredentialsError(err).message),
    onSuccess: (result) => {
      if (result.success) toast.success(result.message);
      else toast.error(result.message);
    },
  });

  function reset() {
    setForm(DEFAULT_FORM);
    setShowForm(false);
    setEditingId(null);
  }

  const credentials = listQuery.data?.credentials ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold">Credenciales de proveedores</h3>
          <p className="text-default-500 text-sm">
            Para scrapers que requieren login. Secrets encriptados AES-256-GCM.
          </p>
        </div>
        <Button
          variant="primary"
          onPress={() => {
            reset();
            setShowForm(true);
          }}
        >
          <PlusIcon className="size-4" />
          Nueva credencial
        </Button>
      </div>

      <div className="overflow-hidden rounded-2xl border border-default-200">
        <table className="w-full text-sm">
          <thead className="bg-default-50">
            <tr className="text-left text-default-600">
              <th className="px-4 py-2">Proveedor</th>
              <th className="px-4 py-2">Etiqueta</th>
              <th className="px-4 py-2">Identificador</th>
              <th className="px-4 py-2">Método</th>
              <th className="px-4 py-2">Último login</th>
              <th className="px-4 py-2">Estado</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {listQuery.isLoading ? (
              <tr>
                <td className="px-4 py-8 text-center text-default-400" colSpan={7}>
                  Cargando…
                </td>
              </tr>
            ) : credentials.length === 0 ? (
              <tr>
                <td className="px-4 py-8 text-center text-default-400" colSpan={7}>
                  Sin credenciales. Agregá una para habilitar scrapers post-login.
                </td>
              </tr>
            ) : (
              credentials.map((c) => (
                <tr className="border-default-100 border-t" key={c.id}>
                  <td className="px-4 py-2 font-medium">{c.provider}</td>
                  <td className="px-4 py-2 text-default-500">{c.label ?? "—"}</td>
                  <td className="px-4 py-2 font-mono text-default-500 text-xs">{c.identifier}</td>
                  <td className="px-4 py-2 text-default-500 text-xs">{c.authMethod}</td>
                  <td className="px-4 py-2 text-default-500 text-xs">
                    {c.lastLoginAt
                      ? dayjs(c.lastLoginAt).format("DD MMM YY HH:mm")
                      : c.lastErrorAt
                        ? `Error ${dayjs(c.lastErrorAt).format("DD MMM YY")}`
                        : "Nunca"}
                  </td>
                  <td className="px-4 py-2">
                    <Chip color={c.isActive ? "success" : "default"} size="sm" variant="soft">
                      {c.isActive ? "Activo" : "Inactivo"}
                    </Chip>
                  </td>
                  <td className="px-4 py-2 text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        isIconOnly
                        isDisabled={testMutation.isPending && testMutation.variables === c.id}
                        size="sm"
                        variant="outline"
                        aria-label="Test"
                        onPress={() => testMutation.mutate(c.id)}
                      >
                        <PlugIcon className="size-3" />
                      </Button>
                      <Button
                        isIconOnly
                        size="sm"
                        variant="outline"
                        aria-label="Editar"
                        onPress={() => {
                          setForm({
                            authMethod: c.authMethod,
                            identifier: c.identifier,
                            isActive: c.isActive,
                            label: c.label ?? "",
                            notes: c.notes ?? "",
                            provider: c.provider,
                            scope: c.scope,
                            secret: "",
                          });
                          setEditingId(c.id);
                          setShowForm(true);
                        }}
                      >
                        <PencilIcon className="size-3" />
                      </Button>
                      <Button
                        isIconOnly
                        size="sm"
                        variant="danger-soft"
                        aria-label="Eliminar"
                        onPress={() => {
                          if (confirm(`¿Eliminar credencial ${c.provider}?`)) {
                            deleteMutation.mutate(c.id);
                          }
                        }}
                      >
                        <Trash2Icon className="size-3" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showForm && (
        <Modal isOpen onOpenChange={(open) => !open && reset()}>
          <Modal.Backdrop>
            <Modal.Container>
              <Modal.Dialog className="sm:max-w-2xl">
                <Modal.CloseTrigger />
                <Modal.Header>
                  <Modal.Heading>
                    {editingId !== null ? "Editar credencial" : "Nueva credencial"}
                  </Modal.Heading>
                </Modal.Header>
                <Modal.Body className="gap-3">
                  <div className="grid grid-cols-2 gap-3">
                    <Select
                      aria-label="Proveedor"
                      selectedKey={form.provider}
                      onSelectionChange={(k) =>
                        k && setForm({ ...form, provider: String(k) as ProviderKind })
                      }
                    >
                      <ListBox>
                        {PROVIDERS.map((p) => (
                          <ListBox.Item id={p.value} key={p.value}>
                            {p.label}
                          </ListBox.Item>
                        ))}
                      </ListBox>
                    </Select>

                    <Select
                      aria-label="Scope"
                      selectedKey={form.scope}
                      onSelectionChange={(k) =>
                        k &&
                        setForm({
                          ...form,
                          scope: String(k) as "BIOALERGIA" | "PERSONAL",
                        })
                      }
                    >
                      <ListBox>
                        <ListBox.Item id="BIOALERGIA">Clínica</ListBox.Item>
                        <ListBox.Item id="PERSONAL">Personal</ListBox.Item>
                      </ListBox>
                    </Select>

                    <Select
                      aria-label="Método autenticación"
                      selectedKey={form.authMethod}
                      onSelectionChange={(k) =>
                        k && setForm({ ...form, authMethod: String(k) as ProviderAuthMethod })
                      }
                    >
                      <ListBox>
                        {AUTH_METHODS.map((m) => (
                          <ListBox.Item id={m.value} key={m.value}>
                            {m.label}
                          </ListBox.Item>
                        ))}
                      </ListBox>
                    </Select>

                    <TextField value={form.label} onChange={(v) => setForm({ ...form, label: v })}>
                      <Label>Etiqueta</Label>
                      <Input placeholder="Ej: Móvil Lucas" />
                    </TextField>

                    <TextField
                      value={form.identifier}
                      onChange={(v) => setForm({ ...form, identifier: v })}
                    >
                      <Label>Identificador</Label>
                      <Input placeholder="RUT / usuario / email" />
                    </TextField>

                    <TextField
                      value={form.secret}
                      onChange={(v) => setForm({ ...form, secret: v })}
                    >
                      <Label>Secret</Label>
                      <Input
                        placeholder={
                          editingId !== null
                            ? "Dejar vacío para no cambiar"
                            : "Contraseña / token / API key"
                        }
                        type="password"
                      />
                    </TextField>
                  </div>

                  <TextField value={form.notes} onChange={(v) => setForm({ ...form, notes: v })}>
                    <Label>Notas</Label>
                    <TextArea rows={3} placeholder="Notas opcionales" />
                  </TextField>

                  <label className="flex items-center gap-2 text-sm">
                    <input
                      checked={form.isActive}
                      type="checkbox"
                      onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                    />
                    Activo
                  </label>

                  <p className="text-default-400 text-xs">
                    ⚠️ Backend usa AES-256-GCM. Necesita env var{" "}
                    <code>PROVIDER_CREDENTIAL_KEY</code> (32-byte hex). Si falta, fallará al
                    guardar.
                  </p>

                  <div className="flex justify-end gap-2 pt-2">
                    <Button variant="outline" onPress={reset}>
                      Cancelar
                    </Button>
                    <Button
                      isDisabled={createMutation.isPending || updateMutation.isPending}
                      variant="primary"
                      onPress={() =>
                        editingId !== null ? updateMutation.mutate() : createMutation.mutate()
                      }
                    >
                      {editingId !== null ? "Actualizar" : "Guardar"}
                    </Button>
                  </div>
                </Modal.Body>
              </Modal.Dialog>
            </Modal.Container>
          </Modal.Backdrop>
        </Modal>
      )}
    </div>
  );
}
