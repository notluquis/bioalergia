import dayjs from "dayjs";
import { z } from "zod";
import { useForm } from "../../../hooks";
import Input from "../../../components/Input";
import Button from "../../../components/Button";
import Alert from "../../../components/Alert";
import type { CreateLoanPayload } from "../types";

const loanFormSchema = z.object({
  title: z.string().trim().min(1, "El título es requerido"),
  borrowerName: z.string().trim().min(1, "El beneficiario es requerido"),
  borrowerType: z.enum(["PERSON", "COMPANY"]),
  principalAmount: z.coerce.number().positive("El monto principal debe ser mayor a 0"),
  interestRate: z.coerce
    .number()
    .min(0, "La tasa de interés debe ser mayor o igual a 0")
    .max(100, "La tasa no puede ser mayor a 100%"),
  interestType: z.enum(["SIMPLE", "COMPOUND"]),
  frequency: z.enum(["WEEKLY", "BIWEEKLY", "MONTHLY"]),
  totalInstallments: z.coerce.number().int().min(1, "Debe tener al menos 1 cuota"),
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
  const form = useForm<LoanFormData>({
    initialValues: {
      title: "",
      borrowerName: "",
      borrowerType: "PERSON",
      principalAmount: 0,
      interestRate: 0,
      interestType: "SIMPLE",
      frequency: "WEEKLY",
      totalInstallments: 10,
      startDate: dayjs().format("YYYY-MM-DD"),
      notes: "",
      generateSchedule: true,
    },
    validationSchema: loanFormSchema,
    onSubmit: async (values) => {
      await onSubmit(values as CreateLoanPayload);
    },
    validateOnBlur: true,
  });

  return (
    <form onSubmit={form.handleSubmit} className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <Input
            label="Título"
            name="title"
            value={form.values.title}
            onChange={form.handleChange("title")}
            onBlur={form.handleBlur("title")}
            required
          />
          {form.getFieldError("title") && <p className="mt-1 text-xs text-red-600">{form.getFieldError("title")}</p>}
        </div>
        <div>
          <Input
            label="Beneficiario"
            name="borrowerName"
            value={form.values.borrowerName}
            onChange={form.handleChange("borrowerName")}
            onBlur={form.handleBlur("borrowerName")}
            required
          />
          {form.getFieldError("borrowerName") && (
            <p className="mt-1 text-xs text-red-600">{form.getFieldError("borrowerName")}</p>
          )}
        </div>
        <div>
          <Input
            label="Tipo"
            type="select"
            name="borrowerType"
            value={form.values.borrowerType}
            onChange={form.handleChange("borrowerType")}
            onBlur={form.handleBlur("borrowerType")}
          >
            <option value="PERSON">Persona natural</option>
            <option value="COMPANY">Empresa</option>
          </Input>
          {form.getFieldError("borrowerType") && (
            <p className="mt-1 text-xs text-red-600">{form.getFieldError("borrowerType")}</p>
          )}
        </div>
        <div>
          <Input
            label="Monto Principal"
            type="number"
            name="principalAmount"
            value={form.values.principalAmount.toString()}
            onChange={form.handleChange("principalAmount")}
            onBlur={form.handleBlur("principalAmount")}
            min={0}
            step="0.01"
            required
          />
          {form.getFieldError("principalAmount") && (
            <p className="mt-1 text-xs text-red-600">{form.getFieldError("principalAmount")}</p>
          )}
        </div>
        <div>
          <Input
            label="Tasa de Interés Anual (%)"
            type="number"
            name="interestRate"
            value={form.values.interestRate.toString()}
            onChange={form.handleChange("interestRate")}
            onBlur={form.handleBlur("interestRate")}
            min={0}
            step="0.01"
            required
          />
          {form.getFieldError("interestRate") && (
            <p className="mt-1 text-xs text-red-600">{form.getFieldError("interestRate")}</p>
          )}
        </div>
        <div>
          <Input
            label="Tipo interés"
            type="select"
            name="interestType"
            value={form.values.interestType}
            onChange={form.handleChange("interestType")}
            onBlur={form.handleBlur("interestType")}
          >
            <option value="SIMPLE">Simple</option>
            <option value="COMPOUND">Compuesto</option>
          </Input>
          {form.getFieldError("interestType") && (
            <p className="mt-1 text-xs text-red-600">{form.getFieldError("interestType")}</p>
          )}
        </div>
        <div>
          <Input
            label="Frecuencia de Pago"
            type="select"
            name="frequency"
            value={form.values.frequency}
            onChange={form.handleChange("frequency")}
            onBlur={form.handleBlur("frequency")}
          >
            <option value="WEEKLY">Semanal</option>
            <option value="BIWEEKLY">Quincenal</option>
            <option value="MONTHLY">Mensual</option>
          </Input>
          {form.getFieldError("frequency") && (
            <p className="mt-1 text-xs text-red-600">{form.getFieldError("frequency")}</p>
          )}
        </div>
        <div>
          <Input
            label="Número de Términos"
            type="number"
            name="totalInstallments"
            value={form.values.totalInstallments.toString()}
            onChange={form.handleChange("totalInstallments")}
            onBlur={form.handleBlur("totalInstallments")}
            min={1}
            max={360}
            required
          />
          {form.getFieldError("totalInstallments") && (
            <p className="mt-1 text-xs text-red-600">{form.getFieldError("totalInstallments")}</p>
          )}
        </div>
        <div>
          <Input
            label="Fecha de Inicio"
            type="date"
            name="startDate"
            value={form.values.startDate}
            onChange={form.handleChange("startDate")}
            onBlur={form.handleBlur("startDate")}
            required
          />
          {form.getFieldError("startDate") && (
            <p className="mt-1 text-xs text-red-600">{form.getFieldError("startDate")}</p>
          )}
        </div>
        <div>
          <label className="flex items-center gap-2 text-xs text-base-content/60">
            <input
              type="checkbox"
              checked={form.values.generateSchedule}
              onChange={(e) => form.setValue("generateSchedule", e.target.checked)}
              className="rounded border-gray-300"
            />
            Generar cronograma automáticamente
          </label>
          {form.getFieldError("generateSchedule") && (
            <p className="mt-1 text-xs text-red-600">{form.getFieldError("generateSchedule")}</p>
          )}
        </div>
      </div>
      <div>
        <Input
          label="Descripción"
          type="textarea"
          name="notes"
          value={form.values.notes || ""}
          onChange={form.handleChange("notes")}
          onBlur={form.handleBlur("notes")}
          rows={3}
        />
        {form.getFieldError("notes") && <p className="mt-1 text-xs text-red-600">{form.getFieldError("notes")}</p>}
      </div>

      {Object.keys(form.errors).length > 0 && (
        <Alert variant="error">Por favor corrige los errores en el formulario antes de continuar.</Alert>
      )}

      <div className="flex justify-end gap-3">
        <Button type="button" variant="secondary" onClick={onCancel} disabled={form.isSubmitting}>
          Cancelar
        </Button>
        <Button type="submit" disabled={form.isSubmitting || !form.isValid}>
          {form.isSubmitting ? "Creando..." : "Crear préstamo"}
        </Button>
      </div>
    </form>
  );
}

export default LoanForm;
