import { Spinner } from "@heroui/react";
import { useForm } from "@tanstack/react-form";
import { useEffect } from "react";
import { z } from "zod";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select, SelectItem } from "@/components/ui/Select";
import { GRID_2_COL_MD } from "@/lib/styles";
import type { CounterpartCategory } from "@/types/schema";

import type { CounterpartUpsertPayload } from "../api";
import { CATEGORY_OPTIONS, EMPTY_FORM } from "../constants";
import type { Counterpart } from "../types";

const counterpartFormSchema = z.object({
  identificationNumber: z.string().min(1, "El RUT es requerido"),
  bankAccountHolder: z.string().min(1, "El nombre del titular es requerido"),
  category: z.enum(["SUPPLIER", "CLIENT", "EMPLOYEE", "PARTNER", "LENDER", "OTHER"] as const),
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
    <section aria-busy={busy} className="surface-recessed relative space-y-5 p-6">
      {loading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center rounded-2xl bg-background/60 backdrop-blur-sm">
          <Spinner size="lg" />
        </div>
      )}
      <div className="flex flex-col gap-1">
        <h1 className="typ-title text-foreground">
          {counterpart ? "Editar contraparte" : "Nueva contraparte"}
        </h1>
        <p className="text-default-600 text-sm">
          Ingresa el RUT y nombre del titular para registrar una contraparte.
        </p>
      </div>
      <form
        className={GRID_2_COL_MD}
        onSubmit={(e) => {
          e.preventDefault();
          void form.handleSubmit();
        }}
      >
        <fieldset className="contents" disabled={busy}>
          <form.Field name="identificationNumber">
            {(field) => (
              <div>
                <Input
                  label="RUT"
                  onBlur={field.handleBlur}
                  onChange={(e) => {
                    field.handleChange(e.target.value);
                  }}
                  placeholder="12345678-9"
                  type="text"
                  value={field.state.value}
                />

                {field.state.meta.errors.length > 0 && (
                  <p className="mt-1 text-danger text-xs">
                    {field.state.meta.errors.map((err) => String(err)).join(", ")}
                  </p>
                )}
              </div>
            )}
          </form.Field>

          <form.Field name="bankAccountHolder">
            {(field) => (
              <div>
                <Input
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

                {field.state.meta.errors.length > 0 && (
                  <p className="mt-1 text-danger text-xs">
                    {field.state.meta.errors.map((err) => String(err)).join(", ")}
                  </p>
                )}
              </div>
            )}
          </form.Field>

          <form.Field name="category">
            {(field) => (
              <div>
                <Select
                  label="Clasificación"
                  onBlur={field.handleBlur}
                  onChange={(key) => {
                    field.handleChange(key as CounterpartCategory);
                  }}
                  value={field.state.value}
                >
                  {CATEGORY_OPTIONS.map((option) => (
                    <SelectItem key={option.value}>{option.label}</SelectItem>
                  ))}
                </Select>
                {field.state.meta.errors.length > 0 && (
                  <p className="mt-1 text-danger text-xs">
                    {field.state.meta.errors.map((err) => String(err)).join(", ")}
                  </p>
                )}
              </div>
            )}
          </form.Field>

          {!counterpart && (
            <form.Field name="notes">
              {(field) => (
                <div className="md:col-span-2">
                  <Input
                    as="textarea"
                    label="Notas"
                    onBlur={field.handleBlur}
                    onChange={(e) => {
                      field.handleChange(e.target.value);
                    }}
                    placeholder="Información adicional..."
                    rows={4}
                    value={field.state.value}
                  />

                  {field.state.meta.errors.length > 0 && (
                    <p className="mt-1 text-danger text-xs">
                      {field.state.meta.errors.map((err) => String(err)).join(", ")}
                    </p>
                  )}
                </div>
              )}
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
    </section>
  );
}
