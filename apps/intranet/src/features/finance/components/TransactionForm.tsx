import type { FinancialTransaction, TransactionCategory } from "@finanzas/db";
import {
  Button,
  DateField,
  DateInputGroup,
  FieldError,
  Input,
  Label,
  ListBox,
  Modal,
  Select,
  TextArea,
  TextField,
} from "@heroui/react";
import { parseDate } from "@internationalized/date";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";
import { type ChangeEvent, useEffect, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { apiClient } from "@/lib/api-client";

const schema = z.object({
  date: z.string(),
  description: z.string().min(1, "Descripción requerida"),
  amount: z.coerce.number().refine((val) => val !== 0, "Monto no puede ser 0"),
  type: z.enum(["INCOME", "EXPENSE", "TRANSFER"]),
  categoryId: z.number().nullable().optional(),
  comment: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

interface Props {
  isOpen: boolean;
  onClose: () => void;
  initialData?: FinancialTransaction | null;
}

const TransactionCategorySchema = z
  .object({
    color: z.string().nullable().optional(),
    id: z.number(),
    name: z.string(),
  })
  .passthrough();

const TransactionCategoriesResponseSchema = z.object({
  data: z.array(TransactionCategorySchema),
  status: z.literal("ok"),
});

const SaveTransactionResponseSchema = z.object({
  data: z.unknown().optional(),
  status: z.literal("ok"),
});

function useTransactionCategories() {
  return useQuery<TransactionCategory[]>({
    queryKey: ["TransactionCategory"],
    queryFn: async () => {
      const payload = await apiClient.get<{ data: TransactionCategory[] }>(
        "/api/finance/categories",
        {
          responseSchema: TransactionCategoriesResponseSchema,
        },
      );
      return payload.data;
    },
  });
}

export function TransactionForm({ isOpen, onClose, initialData }: Props) {
  const queryClient = useQueryClient();
  const { data: categories } = useTransactionCategories();

  const [formData, setFormData] = useState<FormValues>({
    date: dayjs().format("YYYY-MM-DD"),
    description: "",
    amount: 0,
    type: "EXPENSE",
    categoryId: undefined,
    comment: "",
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        setFormData({
          date: dayjs(initialData.date).format("YYYY-MM-DD"),
          description: initialData.description,
          amount: Number(initialData.amount),
          type: initialData.type as "INCOME" | "EXPENSE" | "TRANSFER",
          categoryId: initialData.categoryId ?? undefined,
          comment: initialData.comment ?? "",
        });
      } else {
        setFormData({
          date: dayjs().format("YYYY-MM-DD"),
          description: "",
          amount: 0,
          type: "EXPENSE",
          categoryId: undefined,
          comment: "",
        });
      }
      setErrors({});
    }
  }, [isOpen, initialData]);

  const mutation = useMutation({
    mutationFn: async (data: FormValues) => {
      if (initialData) {
        return apiClient.put(`/api/finance/transactions/${initialData.id}`, data, {
          responseSchema: SaveTransactionResponseSchema,
        });
      }
      return apiClient.post("/api/finance/transactions", data, {
        responseSchema: SaveTransactionResponseSchema,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["FinancialTransaction"] });
      toast.success(initialData ? "Movimiento actualizado" : "Movimiento creado");
      onClose();
    },
    onError: () => {
      toast.error("Error al guardar el movimiento");
    },
  });

  const isSubmitting = mutation.isPending;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    const result = schema.safeParse(formData);
    if (!result.success) {
      const newErrors: Record<string, string> = {};
      for (const issue of result.error.issues) {
        newErrors[issue.path[0] as string] = issue.message;
      }
      setErrors(newErrors);
      return;
    }

    mutation.mutate(result.data);
  };

  const handleChange = (field: keyof FormValues, value: null | number | string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  const isEditMode = Boolean(initialData);

  // HeroUI v3: Modal usa composición con dot notation.
  // El control de apertura se hace en Modal.Backdrop con isOpen/onOpenChange.
  return (
    <Modal>
      <Modal.Backdrop isOpen={isOpen} onOpenChange={(open) => !open && onClose()}>
        <Modal.Container size="lg">
          <Modal.Dialog>
            <Modal.CloseTrigger />
            <Modal.Header>
              <Modal.Heading>
                {initialData ? "Editar Movimiento" : "Nuevo Movimiento"}
              </Modal.Heading>
            </Modal.Header>
            <Modal.Body>
              <form id="transaction-form" onSubmit={handleSubmit} className="flex flex-col gap-4">
                <div className="grid grid-cols-2 gap-4">
                  {/* Fecha */}
                  {!isEditMode ? (
                    <DateField
                      value={formData.date ? parseDate(formData.date) : undefined}
                      onChange={(val) => handleChange("date", val?.toString() ?? "")}
                      isInvalid={!!errors.date}
                    >
                      <Label>Fecha</Label>
                      <DateInputGroup>
                        <DateInputGroup.Input>
                          {(segment) => <DateInputGroup.Segment segment={segment} />}
                        </DateInputGroup.Input>
                      </DateInputGroup>
                      <FieldError>{errors.date}</FieldError>
                    </DateField>
                  ) : null}

                  {/* Tipo */}
                  <Select
                    selectedKey={formData.type}
                    onSelectionChange={(key) => key && handleChange("type", key as string)}
                    isInvalid={!!errors.type}
                    placeholder="Seleccionar tipo"
                  >
                    <Label>Tipo</Label>
                    <Select.Trigger>
                      <Select.Value />
                      <Select.Indicator />
                    </Select.Trigger>
                    <Select.Popover>
                      <ListBox>
                        <ListBox.Item id="INCOME" textValue="Ingreso">
                          Ingreso
                          <ListBox.ItemIndicator />
                        </ListBox.Item>
                        <ListBox.Item id="EXPENSE" textValue="Gasto">
                          Gasto
                          <ListBox.ItemIndicator />
                        </ListBox.Item>
                        <ListBox.Item id="TRANSFER" textValue="Transferencia">
                          Transferencia
                          <ListBox.ItemIndicator />
                        </ListBox.Item>
                      </ListBox>
                    </Select.Popover>
                    {errors.type && <FieldError>{errors.type}</FieldError>}
                  </Select>
                </div>

                {/* Descripción */}
                <TextField isInvalid={!!errors.description}>
                  <Label>Descripción</Label>
                  <Input
                    value={formData.description}
                    onChange={(e: ChangeEvent<HTMLInputElement>) =>
                      handleChange("description", e.target.value)
                    }
                    placeholder="Descripción del movimiento"
                  />
                  <FieldError>{errors.description}</FieldError>
                </TextField>

                <div className="grid grid-cols-2 gap-4">
                  {/* Monto */}
                  {!isEditMode ? (
                    <TextField isInvalid={!!errors.amount}>
                      <Label>Monto</Label>
                      <div className="flex items-center gap-1">
                        <span className="text-default-500 text-sm">$</span>
                        <Input
                          type="number"
                          value={formData.amount.toString()}
                          onChange={(e: ChangeEvent<HTMLInputElement>) =>
                            handleChange("amount", Number(e.target.value))
                          }
                          placeholder="0"
                        />
                      </div>
                      <FieldError>{errors.amount}</FieldError>
                    </TextField>
                  ) : null}

                  {/* Categoría */}
                  <Select
                    selectedKey={
                      formData.categoryId == null ? "__none__" : formData.categoryId.toString()
                    }
                    onSelectionChange={(key) => {
                      const raw = String(key);
                      if (raw === "__none__") {
                        handleChange("categoryId", null);
                        return;
                      }
                      const id = Number(raw);
                      if (Number.isNaN(id)) return;
                      handleChange("categoryId", id);
                    }}
                    isInvalid={!!errors.categoryId}
                    placeholder="Sin categoría"
                  >
                    <Label>Categoría</Label>
                    <Select.Trigger>
                      <Select.Value />
                      <Select.Indicator />
                    </Select.Trigger>
                    <Select.Popover>
                      <ListBox>
                        <ListBox.Item id="__none__" textValue="Sin categoría">
                          Sin categoría
                          <ListBox.ItemIndicator />
                        </ListBox.Item>
                        {(categories ?? []).length === 0 ? (
                          <ListBox.Item id="__empty__" textValue="No hay categorías" isDisabled>
                            No hay categorías disponibles
                          </ListBox.Item>
                        ) : null}
                        {(categories ?? []).map((cat: TransactionCategory) => (
                          <ListBox.Item key={cat.id} id={cat.id.toString()} textValue={cat.name}>
                            <div className="flex items-center gap-2">
                              <div
                                className="w-3 h-3 rounded-full shrink-0"
                                style={{ backgroundColor: cat.color ?? "#ccc" }}
                              />
                              {cat.name}
                            </div>
                            <ListBox.ItemIndicator />
                          </ListBox.Item>
                        ))}
                      </ListBox>
                    </Select.Popover>
                    {errors.categoryId && <FieldError>{errors.categoryId}</FieldError>}
                  </Select>
                </div>

                {/* Comentario */}
                <TextField>
                  <Label>Comentario</Label>
                  <TextArea
                    value={formData.comment ?? ""}
                    onChange={(e: ChangeEvent<HTMLTextAreaElement>) =>
                      handleChange("comment", e.target.value)
                    }
                    placeholder="Notas adicionales (opcional)"
                  />
                </TextField>
              </form>
            </Modal.Body>
            <Modal.Footer>
              <Button variant="secondary" slot="close">
                Cancelar
              </Button>
              <Button type="submit" form="transaction-form" isDisabled={isSubmitting}>
                {isSubmitting ? "Guardando..." : "Guardar"}
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
