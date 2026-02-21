import { FieldError, Label, ListBox, Select, Skeleton, Surface } from "@heroui/react";
import { useForm } from "@tanstack/react-form";
import { useEffect } from "react";
import { z } from "zod";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { GRID_2_COL_MD } from "@/lib/styles";
import type { CounterpartCategory } from "@/types/schema";

import type { CounterpartUpsertPayload } from "../api";
import { CATEGORY_OPTIONS, EMPTY_FORM } from "../constants";
import type { Counterpart } from "../types";

const counterpartFormSchema = z.object({
  identificationNumber: z.string().min(1, "El RUT es requerido"),
  bankAccountHolder: z.string().min(1, "El nombre del titular es requerido"),
  category: z.enum([
    "SUPPLIER",
    "CLIENT",
    "EMPLOYEE",
    "PARTNER",
    "LENDER",
    "PERSONAL_EXPENSE",
    "OTHER",
  ] as const),
  notes: z.string(),
});

interface CounterpartFormProps {
  counterpart?: Counterpart | null;
  error: null | string;
  loading?: boolean;
  onSave: (payload: CounterpartUpsertPayload) => Promise<void>;
  saving: boolean;
}

type CounterpartFormValues = z.infer<typeof counterpartFormSchema>;

function normalizeFieldErrors(errors: unknown[]): string {
  return errors
    .map((error) => {
      if (typeof error === "string") {
        return error;
      }
      if (error && typeof error === "object" && "message" in error) {
        const message = (error as { message?: unknown }).message;
        if (typeof message === "string") {
          return message;
        }
      }
      return "";
    })
    .filter((message) => message.length > 0)
    .join(", ");
}

export function CounterpartForm({
  counterpart,
  error,
  loading = false,
  onSave,
  saving,
}: Readonly<CounterpartFormProps>) {
  const form = useForm({
    defaultValues: {
      category: "SUPPLIER" as CounterpartCategory,
      identificationNumber: "",
      bankAccountHolder: "",
      notes: "",
    } as CounterpartFormValues,
    onSubmit: async ({ value }) => {
      const payload: CounterpartUpsertPayload = {
        identificationNumber: value.identificationNumber,
        bankAccountHolder: value.bankAccountHolder,
        category: value.category,
        notes: value.notes || null,
      };
      await onSave(payload);
    },
    validators: {
      onChange: counterpartFormSchema,
    },
  });

  // Reset form when counterpart changes
  useEffect(() => {
    if (counterpart) {
      form.reset({
        identificationNumber: counterpart.identificationNumber,
        bankAccountHolder: counterpart.bankAccountHolder,
        category: counterpart.category,
        notes: counterpart.notes ?? "",
      });
    } else {
      form.reset({
        ...EMPTY_FORM,
      });
    }
  }, [counterpart, form]);

  const busy = loading || saving || form.state.isSubmitting;

  return (
    <Surface aria-busy={busy} className="relative space-y-5 p-6" variant="secondary">
      {loading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center rounded-2xl bg-background/60 backdrop-blur-sm">
          <div className="w-full max-w-xl space-y-3 p-6">
            <Skeleton className="h-10 w-full rounded-md" />
            <Skeleton className="h-10 w-full rounded-md" />
            <Skeleton className="h-10 w-full rounded-md" />
          </div>
        </div>
      )}
      <form
        className={GRID_2_COL_MD}
        onSubmit={(e) => {
          e.preventDefault();
          void form.handleSubmit();
        }}
      >
        <fieldset className="contents" disabled={busy}>
          <form.Field name="identificationNumber">
            {(field) => {
              const fieldError = normalizeFieldErrors(field.state.meta.errors);
              return (
                <div>
                  <Input
                    error={fieldError || undefined}
                    label="RUT"
                    onBlur={field.handleBlur}
                    onChange={(e) => {
                      field.handleChange(e.target.value);
                    }}
                    placeholder="12345678-9"
                    type="text"
                    value={field.state.value}
                  />
                </div>
              );
            }}
          </form.Field>

          <form.Field name="bankAccountHolder">
            {(field) => {
              const fieldError = normalizeFieldErrors(field.state.meta.errors);
              return (
                <div>
                  <Input
                    error={fieldError || undefined}
                    label="Nombre del titular"
                    onBlur={field.handleBlur}
                    onChange={(e) => {
                      field.handleChange(e.target.value);
                    }}
                    placeholder="Juan Pérez"
                    required
                    type="text"
                    value={field.state.value}
                  />
                </div>
              );
            }}
          </form.Field>

          <form.Field name="category">
            {(field) => {
              const fieldError = normalizeFieldErrors(field.state.meta.errors);
              return (
                <div>
                  <Select
                    isInvalid={Boolean(fieldError)}
                    onBlur={field.handleBlur}
                    onChange={(key) => {
                      field.handleChange(key as CounterpartCategory);
                    }}
                    value={field.state.value}
                  >
                    <Label>Clasificación</Label>
                    <Select.Trigger>
                      <Select.Value />
                      <Select.Indicator />
                    </Select.Trigger>
                    <Select.Popover>
                      <ListBox>
                        {CATEGORY_OPTIONS.map((option) => (
                          <ListBox.Item id={option.value} key={option.value}>
                            {option.label}
                          </ListBox.Item>
                        ))}
                      </ListBox>
                    </Select.Popover>
                    {fieldError && <FieldError>{fieldError}</FieldError>}
                  </Select>
                </div>
              );
            }}
          </form.Field>

          {!counterpart && (
            <form.Field name="notes">
              {(field) => {
                const fieldError = normalizeFieldErrors(field.state.meta.errors);
                return (
                  <div className="md:col-span-2">
                    <Input
                      as="textarea"
                      error={fieldError || undefined}
                      label="Notas"
                      onBlur={field.handleBlur}
                      onChange={(e) => {
                        field.handleChange(e.target.value);
                      }}
                      placeholder="Información adicional..."
                      rows={4}
                      value={field.state.value}
                    />
                  </div>
                );
              }}
            </form.Field>
          )}

          <div className="flex flex-col gap-3 md:col-span-2">
            {error && <Alert status="danger">{error}</Alert>}
            <div className="flex flex-wrap justify-end gap-2">
              <Button disabled={busy} type="submit">
                {busy ? "Guardando..." : "Guardar"}
              </Button>
            </div>
          </div>
        </fieldset>
      </form>
    </Surface>
  );
}
