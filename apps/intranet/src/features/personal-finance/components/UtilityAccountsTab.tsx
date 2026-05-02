import {
  Button,
  Chip,
  FieldError,
  Form,
  Input,
  Label,
  ListBox,
  Modal,
  Select,
  Skeleton,
  TextArea,
  TextField,
} from "@heroui/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";
import { PencilIcon, PlusIcon, RefreshCwIcon, Trash2Icon } from "lucide-react";
import { useState } from "react";

import type { UtilityProvider } from "@finanzas/orpc-contracts/utility-bills";
import { toast } from "@/lib/toast-interceptor";

import { toUtilityBillsError, utilityBillsClient } from "../utility-bills-orpc";

const UTILITY_ACCOUNTS_KEY = ["utility-accounts"] as const;

const PROVIDER_LABELS: Record<UtilityProvider, string> = {
  CGE: "CGE",
  ESSBIO: "ESSBIO",
  OTHER: "Otro",
};

const PROVIDER_COLORS: Record<UtilityProvider, "warning" | "success" | "default"> = {
  CGE: "warning",
  ESSBIO: "success",
  OTHER: "default",
};

type AccountFormState = {
  expenseServiceId: null;
  isActive: boolean;
  label: string;
  notes: string;
  provider: UtilityProvider;
  serviceNumber: string;
};

const DEFAULT_FORM: AccountFormState = {
  expenseServiceId: null,
  isActive: true,
  label: "",
  notes: "",
  provider: "ESSBIO",
  serviceNumber: "",
};

type EditTarget = { id: number; values: AccountFormState } | null;

export function UtilityAccountsTab() {
  const queryClient = useQueryClient();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<EditTarget>(null);
  const [form, setForm] = useState<AccountFormState>(DEFAULT_FORM);

  const { data, isLoading } = useQuery({
    queryFn: () => utilityBillsClient.listAccounts({ scope: "PERSONAL" }),
    queryKey: UTILITY_ACCOUNTS_KEY,
  });

  const createMutation = useMutation({
    mutationFn: (values: AccountFormState) =>
      utilityBillsClient.createAccount({
        expenseServiceId: values.expenseServiceId,
        isActive: values.isActive,
        label: values.label || null,
        notes: values.notes || null,
        provider: values.provider,
        scope: "PERSONAL",
        serviceNumber: values.serviceNumber,
      }),
    onError: (err) => {
      const e = toUtilityBillsError(err);
      toast.error(e.message);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: UTILITY_ACCOUNTS_KEY });
      toast.success("Cuenta creada");
      setIsCreateOpen(false);
      setForm(DEFAULT_FORM);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, values }: { id: number; values: AccountFormState }) =>
      utilityBillsClient.updateAccount({
        id,
        payload: {
          expenseServiceId: values.expenseServiceId,
          isActive: values.isActive,
          label: values.label || null,
          notes: values.notes || null,
          provider: values.provider,
          scope: "PERSONAL",
          serviceNumber: values.serviceNumber,
        },
      }),
    onError: (err) => {
      const e = toUtilityBillsError(err);
      toast.error(e.message);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: UTILITY_ACCOUNTS_KEY });
      toast.success("Cuenta actualizada");
      setEditTarget(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => utilityBillsClient.deleteAccount({ id }),
    onError: (err) => {
      const e = toUtilityBillsError(err);
      toast.error(e.message);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: UTILITY_ACCOUNTS_KEY });
      toast.success("Cuenta eliminada");
    },
  });

  const refreshMutation = useMutation({
    mutationFn: (id: number) => utilityBillsClient.refreshAccount({ id }),
    onError: (err) => {
      const e = toUtilityBillsError(err);
      toast.error(e.message);
    },
    onSuccess: (res) => {
      void queryClient.invalidateQueries({ queryKey: UTILITY_ACCOUNTS_KEY });
      toast.success(
        `Actualizado: ${res.bill.currentAmount.toLocaleString("es-CL", { currency: "CLP", style: "currency" })}`
      );
    },
  });

  const accounts = data?.accounts ?? [];

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-10 w-36 rounded-lg" />
        <Skeleton className="h-24 w-full rounded-xl" />
        <Skeleton className="h-24 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button
          size="sm"
          variant="primary"
          onPress={() => {
            setForm(DEFAULT_FORM);
            setIsCreateOpen(true);
          }}
        >
          <PlusIcon className="size-4" />
          Nueva cuenta
        </Button>
      </div>

      {accounts.length === 0 ? (
        <div className="rounded-xl border border-default-200 border-dashed p-8 text-center text-default-400 text-sm">
          No hay cuentas de servicios básicos registradas.
        </div>
      ) : (
        <div className="space-y-3">
          {accounts.map((account) => (
            <div
              key={account.id}
              className="flex items-center justify-between gap-4 rounded-xl border border-default-200 p-4"
            >
              <div className="flex items-center gap-3 min-w-0">
                <Chip color={PROVIDER_COLORS[account.provider]} size="sm" variant="soft">
                  {PROVIDER_LABELS[account.provider]}
                </Chip>
                <div className="min-w-0">
                  <div className="font-medium text-sm truncate">
                    {account.label ?? account.serviceNumber}
                  </div>
                  {account.label && (
                    <div className="text-xs text-default-400">{account.serviceNumber}</div>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-6 shrink-0">
                {account.lastAmount !== null ? (
                  <div className="text-right">
                    <div className="font-semibold text-sm">
                      {account.lastAmount.toLocaleString("es-CL", {
                        currency: "CLP",
                        style: "currency",
                      })}
                    </div>
                    {account.lastFetchedAt && (
                      <div className="text-xs text-default-400">
                        {dayjs(account.lastFetchedAt).format("DD/MM/YYYY HH:mm")}
                      </div>
                    )}
                  </div>
                ) : (
                  <span className="text-default-400 text-xs">Sin datos</span>
                )}

                <div className="flex gap-1">
                  <Button
                    isIconOnly
                    size="sm"
                    variant="ghost"
                    isDisabled={refreshMutation.isPending}
                    onPress={() => refreshMutation.mutate(account.id)}
                    aria-label="Refrescar"
                  >
                    <RefreshCwIcon className="size-4" />
                  </Button>
                  <Button
                    isIconOnly
                    size="sm"
                    variant="ghost"
                    onPress={() =>
                      setEditTarget({
                        id: account.id,
                        values: {
                          expenseServiceId: null,
                          isActive: account.isActive,
                          label: account.label ?? "",
                          notes: account.notes ?? "",
                          provider: account.provider,
                          serviceNumber: account.serviceNumber,
                        },
                      })
                    }
                    aria-label="Editar"
                  >
                    <PencilIcon className="size-4" />
                  </Button>
                  <Button
                    isIconOnly
                    size="sm"
                    variant="danger-soft"
                    isDisabled={deleteMutation.isPending}
                    onPress={() => deleteMutation.mutate(account.id)}
                    aria-label="Eliminar"
                  >
                    <Trash2Icon className="size-4" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <AccountFormModal
        isOpen={isCreateOpen}
        title="Nueva cuenta"
        values={form}
        isPending={createMutation.isPending}
        onChange={setForm}
        onSubmit={() => createMutation.mutate(form)}
        onClose={() => setIsCreateOpen(false)}
      />

      <AccountFormModal
        isOpen={editTarget !== null}
        title="Editar cuenta"
        values={editTarget?.values ?? DEFAULT_FORM}
        isPending={updateMutation.isPending}
        onChange={(values) => setEditTarget((prev) => (prev ? { ...prev, values } : null))}
        onSubmit={() => {
          if (editTarget) {
            updateMutation.mutate({ id: editTarget.id, values: editTarget.values });
          }
        }}
        onClose={() => setEditTarget(null)}
      />
    </div>
  );
}

function AccountFormModal({
  isOpen,
  isPending,
  onChange,
  onClose,
  onSubmit,
  title,
  values,
}: {
  isOpen: boolean;
  isPending: boolean;
  onChange: (values: AccountFormState) => void;
  onClose: () => void;
  onSubmit: () => void;
  title: string;
  values: AccountFormState;
}) {
  function field<K extends keyof AccountFormState>(key: K) {
    return (value: AccountFormState[K]) => onChange({ ...values, [key]: value });
  }

  return (
    <Modal isOpen={isOpen} onOpenChange={(open) => !open && onClose()}>
      <Modal.Backdrop>
        <Modal.Container>
          <Modal.Dialog className="sm:max-w-md">
            <Modal.CloseTrigger />
            <Modal.Header>
              <Modal.Heading>{title}</Modal.Heading>
            </Modal.Header>
            <Modal.Body className="gap-4">
              <Form
                validationBehavior="aria"
                onSubmit={(e) => {
                  e.preventDefault();
                  onSubmit();
                }}
                className="flex flex-col gap-4"
              >
                <Select
                  className="w-full"
                  value={values.provider}
                  onChange={(key) => field("provider")(key as UtilityProvider)}
                >
                  <Label>Proveedor</Label>
                  <Select.Trigger>
                    <Select.Value />
                    <Select.Indicator />
                  </Select.Trigger>
                  <Select.Popover>
                    <ListBox>
                      <ListBox.Item id="ESSBIO" textValue="ESSBIO">
                        ESSBIO
                        <ListBox.ItemIndicator />
                      </ListBox.Item>
                      <ListBox.Item id="CGE" textValue="CGE">
                        CGE
                        <ListBox.ItemIndicator />
                      </ListBox.Item>
                      <ListBox.Item id="OTHER" textValue="Otro">
                        Otro
                        <ListBox.ItemIndicator />
                      </ListBox.Item>
                    </ListBox>
                  </Select.Popover>
                </Select>

                <TextField
                  value={values.serviceNumber}
                  onChange={field("serviceNumber")}
                  isRequired
                >
                  <Label>Número de servicio</Label>
                  <Input placeholder="Ej: 1234567890" />
                  <FieldError />
                </TextField>

                <TextField value={values.label} onChange={field("label")}>
                  <Label>Etiqueta (opcional)</Label>
                  <Input placeholder="Ej: Casa, Oficina" />
                  <FieldError />
                </TextField>

                <TextField value={values.notes} onChange={field("notes")}>
                  <Label>Notas (opcional)</Label>
                  <TextArea rows={3} placeholder="Observaciones..." />
                  <FieldError />
                </TextField>

                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="ghost" onPress={onClose} type="button">
                    Cancelar
                  </Button>
                  <Button variant="primary" type="submit" isDisabled={isPending}>
                    {isPending ? "Guardando..." : "Guardar"}
                  </Button>
                </div>
              </Form>
            </Modal.Body>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
