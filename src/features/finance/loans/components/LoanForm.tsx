import { z } from "zod";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Input from "@/components/ui/Input";
import { GRID_2_COL_MD } from "@/lib/styles";
import { today } from "@/lib/dates";
import Checkbox from "@/components/ui/Checkbox";
import Button from "@/components/ui/Button";
import Alert from "@/components/ui/Alert";
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
  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting, isValid },
  } = useForm<LoanFormData>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(loanFormSchema) as any, // Type mismatch between Zod output and RHF expectation
    defaultValues: {
      title: "",
      borrowerName: "",
      borrowerType: "PERSON",
      principalAmount: 0,
      interestRate: 0,
      interestType: "SIMPLE",
      frequency: "WEEKLY",
      totalInstallments: 10,
      startDate: today(),
      notes: "",
      generateSchedule: true,
    },
    mode: "onBlur",
  });

  const onFormSubmit = async (values: LoanFormData) => {
    await onSubmit(values as CreateLoanPayload);
  };

  return (
    <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-4">
      <div className={GRID_2_COL_MD}>
        <div>
          <Input label="Título" {...register("title")} required />
          {errors.title && <p className="mt-1 text-xs text-red-600">{errors.title.message}</p>}
        </div>
        <div>
          <Input label="Beneficiario" {...register("borrowerName")} required />
          {errors.borrowerName && <p className="mt-1 text-xs text-red-600">{errors.borrowerName.message}</p>}
        </div>
        <div>
          <Input label="Tipo" as="select" {...register("borrowerType")}>
            <option value="PERSON">Persona natural</option>
            <option value="COMPANY">Empresa</option>
          </Input>
          {errors.borrowerType && <p className="mt-1 text-xs text-red-600">{errors.borrowerType.message}</p>}
        </div>
        <div>
          <Input
            label="Monto Principal"
            type="number"
            {...register("principalAmount", { valueAsNumber: true })}
            min={0}
            step="0.01"
            required
          />
          {errors.principalAmount && <p className="mt-1 text-xs text-red-600">{errors.principalAmount.message}</p>}
        </div>
        <div>
          <Input
            label="Tasa de Interés Anual (%)"
            type="number"
            {...register("interestRate", { valueAsNumber: true })}
            min={0}
            step="0.01"
            required
          />
          {errors.interestRate && <p className="mt-1 text-xs text-red-600">{errors.interestRate.message}</p>}
        </div>
        <div>
          <Input label="Tipo interés" as="select" {...register("interestType")}>
            <option value="SIMPLE">Simple</option>
            <option value="COMPOUND">Compuesto</option>
          </Input>
          {errors.interestType && <p className="mt-1 text-xs text-red-600">{errors.interestType.message}</p>}
        </div>
        <div>
          <Input label="Frecuencia de Pago" as="select" {...register("frequency")}>
            <option value="WEEKLY">Semanal</option>
            <option value="BIWEEKLY">Quincenal</option>
            <option value="MONTHLY">Mensual</option>
          </Input>
          {errors.frequency && <p className="mt-1 text-xs text-red-600">{errors.frequency.message}</p>}
        </div>
        <div>
          <Input
            label="Número de Términos"
            type="number"
            {...register("totalInstallments", { valueAsNumber: true })}
            min={1}
            max={360}
            required
          />
          {errors.totalInstallments && <p className="mt-1 text-xs text-red-600">{errors.totalInstallments.message}</p>}
        </div>
        <div>
          <Input label="Fecha de Inicio" type="date" {...register("startDate")} required />
          {errors.startDate && <p className="mt-1 text-xs text-red-600">{errors.startDate.message}</p>}
        </div>
        <div>
          <Controller
            control={control}
            name="generateSchedule"
            render={({ field: { value, onChange, ...field } }) => (
              <Checkbox label="Generar cronograma automáticamente" checked={value} onChange={onChange} {...field} />
            )}
          />
          {errors.generateSchedule && <p className="mt-1 text-xs text-red-600">{errors.generateSchedule.message}</p>}
        </div>
      </div>
      <div>
        <Input label="Descripción" as="textarea" {...register("notes")} rows={3} />
        {errors.notes && <p className="mt-1 text-xs text-red-600">{errors.notes.message}</p>}
      </div>

      {Object.keys(errors).length > 0 && (
        <Alert variant="error">Por favor corrige los errores en el formulario antes de continuar.</Alert>
      )}

      <div className="flex justify-end gap-3">
        <Button type="button" variant="secondary" onClick={onCancel} disabled={isSubmitting}>
          Cancelar
        </Button>
        <Button type="submit" disabled={isSubmitting || !isValid}>
          {isSubmitting ? "Creando..." : "Crear préstamo"}
        </Button>
      </div>
    </form>
  );
}

export default LoanForm;
