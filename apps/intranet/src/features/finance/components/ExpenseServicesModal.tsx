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
import { PencilIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { useState } from "react";

import type { ExpenseRecurrence, ExpenseScope } from "@finanzas/orpc-contracts/expenses";
import { toast } from "@/lib/toast-interceptor";

import { expensesORPCClient, toExpensesApiError } from "../expenses-orpc";

interface Props {
  onClose: () => void;
}

interface FormState {
  billingDay: string;
  category: string;
  defaultAmount: string;
  detail: string;
  dueDateRule: string;
  isActive: boolean;
  isFixed: boolean;
  name: string;
  notes: string;
  recurrence: ExpenseRecurrence;
  scope: ExpenseScope;
}

const DEFAULT_FORM: FormState = {
  billingDay: "",
  category: "",
  defaultAmount: "",
  detail: "",
  dueDateRule: "",
  isActive: true,
  isFixed: false,
  name: "",
  notes: "",
  recurrence: "MONTHLY",
  scope: "BIOALERGIA",
};

function formatCLP(value: null | number): string {
  if (value === null) return "—";
  return new Intl.NumberFormat("es-CL", {
    currency: "CLP",
    maximumFractionDigits: 0,
    style: "currency",
  }).format(value);
}

function formToPayload(f: FormState) {
  return {
    billingDay: f.billingDay ? Number(f.billingDay) : null,
    category: f.category || null,
    defaultAmount: f.defaultAmount ? Number(f.defaultAmount) : null,
    detail: f.detail || null,
    dueDateRule: f.dueDateRule || null,
    isActive: f.isActive,
    isFixed: f.isFixed,
    name: f.name,
    notes: f.notes || null,
    recurrence: f.recurrence,
    scope: f.scope,
    tags: [] as string[],
  };
}

export function ExpenseServicesModal({ onClose }: Props) {
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState<null | number>(null);
  const [form, setForm] = useState<FormState>(DEFAULT_FORM);
  const [showForm, setShowForm] = useState(false);

  const servicesQuery = useQuery({
    queryFn: () => expensesORPCClient.listServices({}),
    queryKey: ["expenses", "services"],
  });

  const createMutation = useMutation({
    mutationFn: (payload: ReturnType<typeof formToPayload>) =>
      expensesORPCClient.createService(payload),
    onError: (err) => toast.error(toExpensesApiError(err).message),
    onSuccess: () => {
      toast.success("Plantilla creada");
      void queryClient.invalidateQueries({ queryKey: ["expenses", "services"] });
      resetForm();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: ReturnType<typeof formToPayload> }) =>
      expensesORPCClient.updateService({ id, payload }),
    onError: (err) => toast.error(toExpensesApiError(err).message),
    onSuccess: () => {
      toast.success("Plantilla actualizada");
      void queryClient.invalidateQueries({ queryKey: ["expenses", "services"] });
      resetForm();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => expensesORPCClient.deleteService({ id }),
    onError: (err) => toast.error(toExpensesApiError(err).message),
    onSuccess: () => {
      toast.success("Plantilla eliminada");
      void queryClient.invalidateQueries({ queryKey: ["expenses", "services"] });
    },
  });

  function resetForm() {
    setForm(DEFAULT_FORM);
    setEditingId(null);
    setShowForm(false);
  }

  type ServiceItem = NonNullable<typeof servicesQuery.data>["services"][number];

  function handleEdit(svc: ServiceItem) {
    setForm({
      billingDay: svc.billingDay?.toString() ?? "",
      category: svc.category ?? "",
      defaultAmount: svc.defaultAmount?.toString() ?? "",
      detail: svc.detail ?? "",
      dueDateRule: svc.dueDateRule ?? "",
      isActive: svc.isActive,
      isFixed: svc.isFixed,
      name: svc.name,
      notes: svc.notes ?? "",
      recurrence: svc.recurrence,
      scope: svc.scope,
    });
    setEditingId(svc.id);
    setShowForm(true);
  }

  function handleSubmit() {
    const payload = formToPayload(form);
    if (editingId !== null) {
      updateMutation.mutate({ id: editingId, payload });
    } else {
      createMutation.mutate(payload);
    }
  }

  const services = servicesQuery.data?.services ?? [];
  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <Modal isOpen onOpenChange={(open) => !open && onClose()}>
      <Modal.Backdrop>
        <Modal.Container>
          <Modal.Dialog className="sm:max-w-4xl">
            <Modal.CloseTrigger />
            <Modal.Header>
              <div className="flex w-full items-center justify-between">
                <Modal.Heading>Plantillas de gastos recurrentes</Modal.Heading>
                {!showForm && (
                  <Button size="sm" variant="primary" onPress={() => setShowForm(true)}>
                    <PlusIcon className="size-4" />
                    Nueva
                  </Button>
                )}
              </div>
            </Modal.Header>

            <Modal.Body className="gap-3">
              {showForm ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <TextField value={form.name} onChange={(v) => setForm({ ...form, name: v })}>
                      <Label>Nombre</Label>
                      <Input placeholder="Ej: CGE" />
                    </TextField>
                    <TextField
                      value={form.detail}
                      onChange={(v) => setForm({ ...form, detail: v })}
                    >
                      <Label>Detalle</Label>
                      <Input placeholder="Ej: ID 6783234" />
                    </TextField>
                    <Select
                      aria-label="Scope"
                      selectedKey={form.scope}
                      onSelectionChange={(k) =>
                        k && setForm({ ...form, scope: String(k) as ExpenseScope })
                      }
                    >
                      <ListBox>
                        <ListBox.Item id="BIOALERGIA">Clínica</ListBox.Item>
                        <ListBox.Item id="PERSONAL">Personal</ListBox.Item>
                      </ListBox>
                    </Select>
                    <Select
                      aria-label="Recurrencia"
                      selectedKey={form.recurrence}
                      onSelectionChange={(k) =>
                        k && setForm({ ...form, recurrence: String(k) as ExpenseRecurrence })
                      }
                    >
                      <ListBox>
                        <ListBox.Item id="MONTHLY">Mensual</ListBox.Item>
                        <ListBox.Item id="ONE_TIME">Una vez</ListBox.Item>
                      </ListBox>
                    </Select>
                    <TextField
                      value={form.category}
                      onChange={(v) => setForm({ ...form, category: v })}
                    >
                      <Label>Categoría</Label>
                      <Input placeholder="Categoría (label libre)" />
                    </TextField>
                    <TextField
                      value={form.defaultAmount}
                      onChange={(v) => setForm({ ...form, defaultAmount: v })}
                    >
                      <Label>Monto base (CLP)</Label>
                      <Input placeholder="0" inputMode="numeric" />
                    </TextField>
                    <TextField
                      value={form.billingDay}
                      onChange={(v) => setForm({ ...form, billingDay: v })}
                    >
                      <Label>Día vencimiento</Label>
                      <Input placeholder="1-31" inputMode="numeric" />
                    </TextField>
                    <TextField
                      value={form.dueDateRule}
                      onChange={(v) => setForm({ ...form, dueDateRule: v })}
                    >
                      <Label>Regla vencimiento</Label>
                      <Input placeholder="ej: 'último día hábil'" />
                    </TextField>
                  </div>

                  <TextField value={form.notes} onChange={(v) => setForm({ ...form, notes: v })}>
                    <Label>Notas</Label>
                    <TextArea rows={3} placeholder="Notas opcionales" />
                  </TextField>

                  <div className="flex items-center gap-4 text-sm">
                    <label className="flex items-center gap-2">
                      <input
                        checked={form.isFixed}
                        type="checkbox"
                        onChange={(e) => setForm({ ...form, isFixed: e.target.checked })}
                      />
                      Monto fijo
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        checked={form.isActive}
                        type="checkbox"
                        onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                      />
                      Activo
                    </label>
                  </div>

                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onPress={resetForm}>
                      Cancelar
                    </Button>
                    <Button isDisabled={isPending} variant="primary" onPress={handleSubmit}>
                      {editingId !== null ? "Actualizar" : "Crear"}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="max-h-[60vh] overflow-auto rounded-xl border border-default-200">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-default-50">
                      <tr className="text-left text-default-600">
                        <th className="px-3 py-2">Nombre</th>
                        <th className="px-3 py-2">Detalle</th>
                        <th className="px-3 py-2">Scope</th>
                        <th className="px-3 py-2">Día venc</th>
                        <th className="px-3 py-2 text-right">Monto base</th>
                        <th className="px-3 py-2">Estado</th>
                        <th className="px-3 py-2" />
                      </tr>
                    </thead>
                    <tbody>
                      {servicesQuery.isLoading ? (
                        <tr>
                          <td className="px-3 py-6 text-center text-default-400" colSpan={7}>
                            Cargando…
                          </td>
                        </tr>
                      ) : services.length === 0 ? (
                        <tr>
                          <td className="px-3 py-6 text-center text-default-400" colSpan={7}>
                            Sin plantillas. Crea una.
                          </td>
                        </tr>
                      ) : (
                        services.map((s) => (
                          <tr className="border-default-100 border-t" key={s.id}>
                            <td className="px-3 py-2 font-medium">{s.name}</td>
                            <td className="px-3 py-2 text-default-500">{s.detail ?? "—"}</td>
                            <td className="px-3 py-2 text-default-500 text-xs">{s.scope}</td>
                            <td className="px-3 py-2 text-default-500 text-xs">
                              {s.billingDay ?? s.dueDateRule ?? "—"}
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums">
                              {formatCLP(s.defaultAmount)}
                            </td>
                            <td className="px-3 py-2">
                              <Chip
                                color={s.isActive ? "success" : "default"}
                                size="sm"
                                variant="soft"
                              >
                                {s.isActive ? "Activo" : "Inactivo"}
                              </Chip>
                            </td>
                            <td className="px-3 py-2 text-right">
                              <div className="flex justify-end gap-1">
                                <Button
                                  isIconOnly
                                  size="sm"
                                  variant="outline"
                                  aria-label="Editar"
                                  onPress={() => handleEdit(s)}
                                >
                                  <PencilIcon className="size-3" />
                                </Button>
                                <Button
                                  isIconOnly
                                  size="sm"
                                  variant="danger-soft"
                                  aria-label="Eliminar"
                                  onPress={() => {
                                    if (
                                      confirm(
                                        `¿Eliminar "${s.name}"? Los Expenses históricos se desvinculan.`
                                      )
                                    ) {
                                      deleteMutation.mutate(s.id);
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
              )}

              <div className="flex justify-end pt-2">
                <Button variant="outline" onPress={onClose}>
                  Cerrar
                </Button>
              </div>
            </Modal.Body>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
