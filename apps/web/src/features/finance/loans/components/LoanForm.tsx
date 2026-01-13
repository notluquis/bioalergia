import { useForm, useStore } from "@tanstack/react-form";
import { z } from "zod";

import Alert from "@/components/ui/Alert";
import Button from "@/components/ui/Button";
import Checkbox from "@/components/ui/Checkbox";
import Input from "@/components/ui/Input";
import { today } from "@/lib/dates";
import { GRID_2_COL_MD } from "@/lib/styles";

import type { CreateLoanPayload } from "../types";

const loanFormSchema = z.object({
  title: z.string().trim().min(1, "El título es requerido"),
  borrowerName: z.string().trim().min(1, "El beneficiario es requerido"),
  borrowerType: z.enum(["PERSON", "COMPANY"]),
  principalAmount: z.number().positive("El monto principal debe ser mayor a 0"),
  interestRate: z
    .number()
    .min(0, "La tasa de interés debe ser mayor o igual a 0")
    .max(100, "La tasa no puede ser mayor a 100%"),
  interestType: z.enum(["SIMPLE", "COMPOUND"]),
  frequency: z.enum(["WEEKLY", "BIWEEKLY", "MONTHLY"]),
  totalInstallments: z.number().int().min(1, "Debe tener al menos 1 cuota"),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida"),
  notes: z.string().optional(),
  generateSchedule: z.boolean(),
});

type LoanFormData = z.infer<typeof loanFormSchema>;

interface LoanFormProps {
  onSubmit: (payload: CreateLoanPayload) => Promise<void>;
  onCancel: () => void;
}

export function LoanForm({ onSubmit, onCancel }: LoanFormProps) {
  const form = useForm({
    defaultValues: {
      title: "",
      borrowerName: "",
      borrowerType: "PERSON" as const,
      principalAmount: 0,
      interestRate: 0,
      interestType: "SIMPLE" as const,
      frequency: "WEEKLY" as const,
      totalInstallments: 10,
      startDate: today(),
      notes: "",
      generateSchedule: true,
    } as LoanFormData,
    validators: {
      onBlur: loanFormSchema,
    },
    onSubmit: async ({ value }) => {
      await onSubmit(value as CreateLoanPayload);
    },
  });

  const hasErrors = useStore(form.store, (state) =>
    Object.values(state.fieldMeta).some((meta) => meta && meta.errors.length > 0)
  );

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        form.handleSubmit();
      }}
      className="space-y-4"
    >
      <div className={GRID_2_COL_MD}>
        <form.Field name="title">
          {(field) => (
            <div>
              <Input
                label="Título"
                required
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
                onBlur={field.handleBlur}
              />
              {field.state.meta.errors.length > 0 && (
                <p className="text-error mt-1 text-xs">{field.state.meta.errors.join(", ")}</p>
              )}
            </div>
          )}
        </form.Field>

        <form.Field name="borrowerName">
          {(field) => (
            <div>
              <Input
                label="Beneficiario"
                required
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
                onBlur={field.handleBlur}
              />
              {field.state.meta.errors.length > 0 && (
                <p className="text-error mt-1 text-xs">{field.state.meta.errors.join(", ")}</p>
              )}
            </div>
          )}
        </form.Field>

        <form.Field name="borrowerType">
          {(field) => (
            <div>
              <Input
                label="Tipo"
                as="select"
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value as "PERSON" | "COMPANY")}
                onBlur={field.handleBlur}
              >
                <option value="PERSON">Persona natural</option>
                <option value="COMPANY">Empresa</option>
              </Input>
              {field.state.meta.errors.length > 0 && (
                <p className="text-error mt-1 text-xs">{field.state.meta.errors.join(", ")}</p>
              )}
            </div>
          )}
        </form.Field>

        <form.Field name="principalAmount">
          {(field) => (
            <div>
              <Input
                label="Monto Principal"
                type="number"
                min={0}
                step="0.01"
                required
                value={field.state.value}
                onChange={(e) => field.handleChange(Number.parseFloat(e.target.value) || 0)}
                onBlur={field.handleBlur}
              />
              {field.state.meta.errors.length > 0 && (
                <p className="text-error mt-1 text-xs">{field.state.meta.errors.join(", ")}</p>
              )}
            </div>
          )}
        </form.Field>

        <form.Field name="interestRate">
          {(field) => (
            <div>
              <Input
                label="Tasa de Interés Anual (%)"
                type="number"
                min={0}
                step="0.01"
                required
                value={field.state.value}
                onChange={(e) => field.handleChange(Number.parseFloat(e.target.value) || 0)}
                onBlur={field.handleBlur}
              />
              {field.state.meta.errors.length > 0 && (
                <p className="text-error mt-1 text-xs">{field.state.meta.errors.join(", ")}</p>
              )}
            </div>
          )}
        </form.Field>

        <form.Field name="interestType">
          {(field) => (
            <div>
              <Input
                label="Tipo interés"
                as="select"
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value as "SIMPLE" | "COMPOUND")}
                onBlur={field.handleBlur}
              >
                <option value="SIMPLE">Simple</option>
                <option value="COMPOUND">Compuesto</option>
              </Input>
              {field.state.meta.errors.length > 0 && (
                <p className="text-error mt-1 text-xs">{field.state.meta.errors.join(", ")}</p>
              )}
            </div>
          )}
        </form.Field>

        <form.Field name="frequency">
          {(field) => (
            <div>
              <Input
                label="Frecuencia de Pago"
                as="select"
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value as "WEEKLY" | "BIWEEKLY" | "MONTHLY")}
                onBlur={field.handleBlur}
              >
                <option value="WEEKLY">Semanal</option>
                <option value="BIWEEKLY">Quincenal</option>
                <option value="MONTHLY">Mensual</option>
              </Input>
              {field.state.meta.errors.length > 0 && (
                <p className="text-error mt-1 text-xs">{field.state.meta.errors.join(", ")}</p>
              )}
            </div>
          )}
        </form.Field>

        <form.Field name="totalInstallments">
          {(field) => (
            <div>
              <Input
                label="Número de Términos"
                type="number"
                min={1}
                max={360}
                required
                value={field.state.value}
                onChange={(e) => field.handleChange(Number.parseInt(e.target.value, 10) || 1)}
                onBlur={field.handleBlur}
              />
              {field.state.meta.errors.length > 0 && (
                <p className="text-error mt-1 text-xs">{field.state.meta.errors.join(", ")}</p>
              )}
            </div>
          )}
        </form.Field>

        <form.Field name="startDate">
          {(field) => (
            <div>
              <Input
                label="Fecha de Inicio"
                type="date"
                required
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
                onBlur={field.handleBlur}
              />
              {field.state.meta.errors.length > 0 && (
                <p className="text-error mt-1 text-xs">{field.state.meta.errors.join(", ")}</p>
              )}
            </div>
          )}
        </form.Field>

        <form.Field name="generateSchedule">
          {(field) => (
            <div>
              <Checkbox
                label="Generar cronograma automáticamente"
                checked={field.state.value}
                onChange={(e) => field.handleChange(e.target.checked)}
              />
              {field.state.meta.errors.length > 0 && (
                <p className="text-error mt-1 text-xs">{field.state.meta.errors.join(", ")}</p>
              )}
            </div>
          )}
        </form.Field>
      </div>

      <form.Field name="notes">
        {(field) => (
          <div>
            <Input
              label="Descripción"
              as="textarea"
              rows={3}
              value={field.state.value ?? ""}
              onChange={(e) => field.handleChange(e.target.value)}
              onBlur={field.handleBlur}
            />
            {field.state.meta.errors.length > 0 && (
              <p className="text-error mt-1 text-xs">{field.state.meta.errors.join(", ")}</p>
            )}
          </div>
        )}
      </form.Field>

      {hasErrors && <Alert variant="error">Por favor corrige los errores en el formulario antes de continuar.</Alert>}

      <div className="flex justify-end gap-3">
        <Button type="button" variant="secondary" onClick={onCancel} disabled={form.state.isSubmitting}>
          Cancelar
        </Button>
        <Button type="submit" disabled={form.state.isSubmitting || !form.state.canSubmit}>
          {form.state.isSubmitting ? "Creando..." : "Crear préstamo"}
        </Button>
      </div>
    </form>
  );
}

export default LoanForm;
