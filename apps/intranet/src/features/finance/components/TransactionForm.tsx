import {
  Button,
  Chip,
  DateField,
  FieldError,
  Input,
  Label,
  ListBox,
  Modal,
  NumberField,
  Select,
  TextArea,
  TextField,
} from "@heroui/react";
import { parseDate } from "@internationalized/date";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";
import { useEffect, useState } from "react";
import { z } from "zod";
import { toast } from "@/lib/toast-interceptor";
import { financeORPCClient, toFinanceApiError } from "../orpc";
import { isNonAccountableCategory } from "../utils/non-accountable-category";
import type { CashFlowTransaction, TransactionCategoryOption } from "./CashFlowColumns";

const schema = z.object({
  date: z.string(),
  description: z.string().min(1, "Descripción requerida"),
  amount: z.coerce.number().positive("Monto debe ser mayor a 0"), // UI enforces via minValue={0.01}
  type: z.enum(["INCOME", "EXPENSE"]),
  categoryId: z.number().nullable().optional(),
  comment: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

interface Props {
  isOpen: boolean;
  onClose: () => void;
  initialData?: CashFlowTransaction | null;
}

const TransactionCategorySchema: z.ZodType<TransactionCategoryOption> = z
  .object({
    color: z.string().nullable().optional(),
    id: z.number(),
    type: z.enum(["INCOME", "EXPENSE"]),
    icon: z.string().nullable().optional(),
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
  return useQuery<TransactionCategoryOption[]>({
    queryKey: ["TransactionCategory"],
    queryFn: async () => {
      const payload = TransactionCategoriesResponseSchema.parse(
        await financeORPCClient.categoriesList()
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
          type: initialData.type === "INCOME" ? "INCOME" : "EXPENSE",
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
      try {
        if (initialData) {
          return SaveTransactionResponseSchema.parse(
            await financeORPCClient.transactionsUpdate({ id: initialData.id, payload: data })
          );
        }
        return SaveTransactionResponseSchema.parse(
          await financeORPCClient.transactionsCreate(data)
        );
      } catch (error) {
        throw toFinanceApiError(error);
      }
    },
    onSuccess: () => {
      void Promise.all([queryClient.invalidateQueries({ queryKey: ["FinancialTransaction"] })]);
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
                      <DateField.Group>
                        <DateField.InputContainer>
                          <DateField.Input>
                            {(segment) => <DateField.Segment segment={segment} />}
                          </DateField.Input>
                        </DateField.InputContainer>
                      </DateField.Group>
                      <FieldError>{errors.date}</FieldError>
                    </DateField>
                  ) : null}

                  {/* Tipo */}
                  <Select
                    value={formData.type}
                    onChange={(key) => key && handleChange("type", key as string)}
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
                        <ListBox.Item id="EXPENSE" textValue="Egreso">
                          Egreso
                          <ListBox.ItemIndicator />
                        </ListBox.Item>
                      </ListBox>
                    </Select.Popover>
                    {errors.type && <FieldError>{errors.type}</FieldError>}
                  </Select>
                </div>

                {/* Descripción */}
                <TextField
                  isInvalid={!!errors.description}
                  onChange={(v) => handleChange("description", v)}
                  value={formData.description}
                >
                  <Label>Descripción</Label>
                  <Input
                    aria-describedby={errors.description ? "description-error" : undefined}
                    aria-invalid={!!errors.description}
                    placeholder="Descripción del movimiento"
                  />
                  <FieldError id="description-error">{errors.description}</FieldError>
                </TextField>

                <div className="grid grid-cols-2 gap-4">
                  {/* Monto */}
                  {!isEditMode ? (
                    <NumberField
                      formatOptions={{
                        currency: "CLP",
                        currencyDisplay: "symbol",
                        maximumFractionDigits: 0,
                        minimumFractionDigits: 0,
                        style: "currency",
                      }}
                      isInvalid={!!errors.amount}
                      minValue={0.01}
                      onChange={(value) => handleChange("amount", value ?? 0)}
                      value={formData.amount}
                    >
                      <Label>Monto</Label>
                      <NumberField.Group>
                        <NumberField.Input />
                      </NumberField.Group>
                      <FieldError>{errors.amount}</FieldError>
                    </NumberField>
                  ) : null}

                  {/* Categoría */}
                  <Select
                    value={
                      formData.categoryId == null ? "__none__" : formData.categoryId.toString()
                    }
                    onChange={(key) => {
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
                        {(categories ?? []).map((cat: TransactionCategoryOption) => (
                          <ListBox.Item key={cat.id} id={cat.id.toString()} textValue={cat.name}>
                            <div className="flex items-center gap-2">
                              <div
                                className="w-3 h-3 rounded-full shrink-0"
                                style={{ backgroundColor: cat.color ?? "#ccc" }}
                              />
                              <span>{cat.name}</span>
                              {isNonAccountableCategory(cat) ? (
                                <Chip color="warning" size="sm" variant="soft">
                                  No contabilizable
                                </Chip>
                              ) : null}
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
                <TextField
                  onChange={(v) => handleChange("comment", v)}
                  value={formData.comment ?? ""}
                >
                  <Label>Comentario</Label>
                  <TextArea placeholder="Notas adicionales (opcional)" />
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
