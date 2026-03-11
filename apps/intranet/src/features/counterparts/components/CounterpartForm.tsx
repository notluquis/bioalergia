import { Alert, Button, Form, Skeleton, Surface } from "@heroui/react";
import { useForm } from "@tanstack/react-form";
import { useEffect } from "react";
import { z } from "zod";
import {
  TanStackInputField,
  TanStackSelectField,
  TanStackTextAreaField,
} from "@/components/forms/TanStackFieldControls";
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
      <Form
        className={GRID_2_COL_MD}
        onSubmit={(e: React.FormEvent<HTMLFormElement>) => {
          e.preventDefault();
          void form.handleSubmit();
        }}
        validationBehavior="aria"
      >
        <fieldset className="contents" disabled={busy}>
          <form.Field name="identificationNumber">
            {(field) => (
              <TanStackInputField
                field={field}
                label="RUT"
                placeholder="12345678-9"
                required
                type="text"
              />
            )}
          </form.Field>

          <form.Field name="bankAccountHolder">
            {(field) => (
              <TanStackInputField
                field={field}
                label="Nombre del titular"
                placeholder="Juan Pérez"
                required
                type="text"
              />
            )}
          </form.Field>

          <form.Field name="category">
            {(field) => (
              <TanStackSelectField
                field={field}
                label="Clasificación"
                options={CATEGORY_OPTIONS.map((option) => ({
                  label: option.label,
                  value: option.value,
                }))}
              />
            )}
          </form.Field>

          {!counterpart && (
            <form.Field name="notes">
              {(field) => (
                <div className="md:col-span-2">
                  <TanStackTextAreaField
                    field={field}
                    label="Notas"
                    placeholder="Información adicional..."
                    rows={4}
                  />
                </div>
              )}
            </form.Field>
          )}

          <div className="flex flex-col gap-3 md:col-span-2">
            {error && <Alert status="danger">{error}</Alert>}
            <div className="flex flex-wrap justify-end gap-2">
              <Button isDisabled={busy} type="submit">
                {busy ? "Guardando..." : "Guardar"}
              </Button>
            </div>
          </div>
        </fieldset>
      </Form>
    </Surface>
  );
}
