import { useForm, useStore } from "@tanstack/react-form";
import dayjs from "dayjs";
import { z } from "zod";

import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { Input } from "@/components/ui/Input";
import { Select, SelectItem } from "@/components/ui/Select";
import { zDateString } from "@/lib/api-validate";
import { GRID_2_COL_MD } from "@/lib/styles";

import type { CreateLoanPayload } from "../types";

const loanFormSchema = z.object({
  borrowerName: z.string().trim().min(1, "El beneficiario es requerido"),
  borrowerType: z.enum(["PERSON", "COMPANY"]),
  frequency: z.enum(["WEEKLY", "BIWEEKLY", "MONTHLY"]),
  generateSchedule: z.boolean(),
  interestRate: z
    .number()
    .min(0, "La tasa de interés debe ser mayor o igual a 0")
    .max(100, "La tasa no puede ser mayor a 100%"),
  interestType: z.enum(["SIMPLE", "COMPOUND"]),
  notes: z.string().optional(),
  principalAmount: z.number().positive("El monto principal debe ser mayor a 0"),
  startDate: zDateString,
  title: z.string().trim().min(1, "El título es requerido"),
  totalInstallments: z.number().int().min(1, "Debe tener al menos 1 cuota"),
});

type LoanFormData = z.infer<typeof loanFormSchema>;

interface LoanFormProps {
  readonly onCancel: () => void;
  readonly onSubmit: (payload: CreateLoanPayload) => Promise<void>;
}

export function LoanForm({ onCancel, onSubmit }: LoanFormProps) {
  const form = useForm({
    defaultValues: {
      borrowerName: "",
      borrowerType: "PERSON" as const,
      frequency: "WEEKLY" as const,
      generateSchedule: true,
      interestRate: 0,
      interestType: "SIMPLE" as const,
      notes: "",
      principalAmount: 0,
      startDate: dayjs().format("YYYY-MM-DD"),
      title: "",
      totalInstallments: 10,
    } as LoanFormData,
    onSubmit: async ({ value }) => {
      await onSubmit(value as CreateLoanPayload);
    },
    validators: {
      onBlur: loanFormSchema,
    },
  });

  const hasErrors = useStore(form.store, (state) =>
    Object.values(state.fieldMeta).some((meta) => meta.errors.length > 0),
  );

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        void form.handleSubmit();
      }}
    >
      <div className={GRID_2_COL_MD}>
        <form.Field name="title">
          {(field) => (
            <div>
              <Input
                label="Título"
                onBlur={field.handleBlur}
                onChange={(e) => {
                  field.handleChange(e.target.value);
                }}
                required
                value={field.state.value}
              />

              {field.state.meta.errors.length > 0 && (
                <p className="mt-1 text-danger text-xs">{field.state.meta.errors.join(", ")}</p>
              )}
            </div>
          )}
        </form.Field>

        <form.Field name="borrowerName">
          {(field) => (
            <div>
              <Input
                label="Beneficiario"
                onBlur={field.handleBlur}
                onChange={(e) => {
                  field.handleChange(e.target.value);
                }}
                required
                value={field.state.value}
              />

              {field.state.meta.errors.length > 0 && (
                <p className="mt-1 text-danger text-xs">{field.state.meta.errors.join(", ")}</p>
              )}
            </div>
          )}
        </form.Field>

        <form.Field name="borrowerType">
          {(field) => (
            <div>
              <Select
                errorMessage={field.state.meta.errors.join(", ")}
                isInvalid={field.state.meta.errors.length > 0}
                label="Tipo de Deudor"
                onBlur={field.handleBlur}
                onChange={(key) => {
                  field.handleChange(key as "COMPANY" | "PERSON");
                }}
                value={field.state.value}
              >
                <SelectItem key="PERSON">Persona</SelectItem>
                <SelectItem key="COMPANY">Empresa</SelectItem>
              </Select>
            </div>
          )}
        </form.Field>

        <form.Field name="principalAmount">
          {(field) => (
            <div>
              <Input
                label="Monto Principal"
                min={0}
                onBlur={field.handleBlur}
                onChange={(e) => {
                  field.handleChange(Number.parseFloat(e.target.value) || 0);
                }}
                required
                step="0.01"
                type="number"
                value={field.state.value}
              />

              {field.state.meta.errors.length > 0 && (
                <p className="mt-1 text-danger text-xs">{field.state.meta.errors.join(", ")}</p>
              )}
            </div>
          )}
        </form.Field>

        <form.Field name="interestRate">
          {(field) => (
            <div>
              <Input
                label="Tasa de Interés Anual (%)"
                min={0}
                onBlur={field.handleBlur}
                onChange={(e) => {
                  field.handleChange(Number.parseFloat(e.target.value) || 0);
                }}
                required
                step="0.01"
                type="number"
                value={field.state.value}
              />

              {field.state.meta.errors.length > 0 && (
                <p className="mt-1 text-danger text-xs">{field.state.meta.errors.join(", ")}</p>
              )}
            </div>
          )}
        </form.Field>

        <form.Field name="interestType">
          {(field) => (
            <div>
              <Select
                errorMessage={field.state.meta.errors.join(", ")}
                isInvalid={field.state.meta.errors.length > 0}
                label="Tipo de Interés"
                onBlur={field.handleBlur}
                onChange={(key) => {
                  field.handleChange(key as "COMPOUND" | "SIMPLE");
                }}
                value={field.state.value}
              >
                <SelectItem key="SIMPLE">Simple</SelectItem>
                <SelectItem key="COMPOUND">Compuesto</SelectItem>
              </Select>
            </div>
          )}
        </form.Field>

        <form.Field name="frequency">
          {(field) => (
            <div>
              <Select
                errorMessage={field.state.meta.errors.join(", ")}
                isInvalid={field.state.meta.errors.length > 0}
                label="Frecuencia de Pago"
                onBlur={field.handleBlur}
                onChange={(key) => {
                  field.handleChange(key as "BIWEEKLY" | "MONTHLY" | "WEEKLY");
                }}
                value={field.state.value}
              >
                <SelectItem key="WEEKLY">Semanal</SelectItem>
                <SelectItem key="BIWEEKLY">Quincenal</SelectItem>
                <SelectItem key="MONTHLY">Mensual</SelectItem>
              </Select>
            </div>
          )}
        </form.Field>

        <form.Field name="totalInstallments">
          {(field) => (
            <div>
              <Input
                label="Número de Términos"
                max={360}
                min={1}
                onBlur={field.handleBlur}
                onChange={(e) => {
                  field.handleChange(Number.parseInt(e.target.value, 10) || 1);
                }}
                required
                type="number"
                value={field.state.value}
              />

              {field.state.meta.errors.length > 0 && (
                <p className="mt-1 text-danger text-xs">{field.state.meta.errors.join(", ")}</p>
              )}
            </div>
          )}
        </form.Field>

        <form.Field name="startDate">
          {(field) => (
            <div>
              <Input
                label="Fecha de Inicio"
                onBlur={field.handleBlur}
                onChange={(e) => {
                  field.handleChange(e.target.value);
                }}
                required
                type="date"
                value={field.state.value}
              />

              {field.state.meta.errors.length > 0 && (
                <p className="mt-1 text-danger text-xs">{field.state.meta.errors.join(", ")}</p>
              )}
            </div>
          )}
        </form.Field>

        <form.Field name="generateSchedule">
          {(field) => (
            <div>
              <Checkbox
                checked={field.state.value}
                label="Generar cronograma automáticamente"
                onCheckedChange={field.handleChange}
              />

              {field.state.meta.errors.length > 0 && (
                <p className="mt-1 text-danger text-xs">{field.state.meta.errors.join(", ")}</p>
              )}
            </div>
          )}
        </form.Field>
      </div>

      <form.Field name="notes">
        {(field) => (
          <div>
            <Input
              as="textarea"
              label="Descripción"
              onBlur={field.handleBlur}
              onChange={(e) => {
                field.handleChange(e.target.value);
              }}
              rows={3}
              value={field.state.value ?? ""}
            />

            {field.state.meta.errors.length > 0 && (
              <p className="mt-1 text-danger text-xs">{field.state.meta.errors.join(", ")}</p>
            )}
          </div>
        )}
      </form.Field>

      {hasErrors && (
        <Alert status="danger">
          Por favor corrige los errores en el formulario antes de continuar.
        </Alert>
      )}

      <div className="flex justify-end gap-3">
        <Button
          disabled={form.state.isSubmitting}
          onClick={onCancel}
          type="button"
          variant="secondary"
        >
          Cancelar
        </Button>
        <Button disabled={form.state.isSubmitting || !form.state.canSubmit} type="submit">
          {form.state.isSubmitting ? "Creando..." : "Crear préstamo"}
        </Button>
      </div>
    </form>
  );
}
