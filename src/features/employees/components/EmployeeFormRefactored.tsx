import React, { useEffect } from "react";
import { z } from "zod";
import { useAuth } from "../../../context/auth-context";
import { createEmployee, updateEmployee } from "../api";
import { useForm } from "../../../hooks/useForm";
import type { Employee } from "../types";
import Button from "../../../components/Button";
import Input from "../../../components/Input";
import { formatRut, normalizeRut } from "../../../lib/rut";
import Alert from "../../../components/Alert";

const employeeFormSchema = z.object({
  no_fixed_schedule: z.boolean().optional(),
  full_name: z.string().trim().min(1, "El nombre completo es requerido"),
  role: z.string().trim().min(1, "El cargo es requerido"),
  email: z.string().trim().email("Email inválido").optional().or(z.literal("")),
  rut: z.string().trim().max(20).optional().or(z.literal("")),
  bank_name: z.string().trim().max(120).optional().or(z.literal("")),
  bank_account_type: z.string().trim().max(32).optional().or(z.literal("")),
  bank_account_number: z.string().trim().max(64).optional().or(z.literal("")),
  salary_type: z.enum(["hourly", "fixed"]).default("hourly"),
  hourly_rate: z.coerce.number().min(0).optional(),
  fixed_salary: z.coerce.number().min(0).optional(),
  overtime_rate: z.coerce.number().min(0, "La tarifa de horas extra debe ser mayor o igual a 0").optional(),
  retention_rate: z.coerce.number().min(0).max(1, "La tasa de retención debe estar entre 0 y 1"),
});

type EmployeeFormData = z.infer<typeof employeeFormSchema>;

const INITIAL_VALUES: EmployeeFormData = {
  no_fixed_schedule: false,
  full_name: "",
  role: "",
  email: "",
  rut: "",
  bank_name: "",
  bank_account_type: "",
  bank_account_number: "",
  salary_type: "hourly",
  hourly_rate: 0,
  fixed_salary: undefined,
  overtime_rate: undefined,
  retention_rate: 0.145,
};

interface EmployeeFormProps {
  employee?: Employee | null;
  onSave: () => void;
  onCancel: () => void;
}

export default function EmployeeForm({ employee, onSave, onCancel }: EmployeeFormProps) {
  const { hasRole } = useAuth();
  const canEdit = hasRole("GOD", "ADMIN");

  const form = useForm({
    initialValues: INITIAL_VALUES,
    validationSchema: employeeFormSchema,
    onSubmit: async (values) => {
      if (!canEdit) return;

      const payload = {
        full_name: values.full_name,
        role: values.role,
        email: values.email || null,
        rut: values.rut || null,
        bank_name: values.bank_name || null,
        bank_account_type: values.bank_account_type || null,
        bank_account_number: values.bank_account_number || null,
        salary_type: values.salary_type === "fixed" ? "fixed" : ("hourly" as "hourly" | "fixed"),
        hourly_rate: values.salary_type === "hourly" ? values.hourly_rate : undefined,
        fixed_salary: values.salary_type === "fixed" ? values.fixed_salary : undefined,
        overtime_rate: values.overtime_rate || null,
        retention_rate: values.retention_rate,
        metadata: { ...(employee?.metadata ?? {}), no_fixed_schedule: values.no_fixed_schedule ?? false },
      };

      if (employee?.id) {
        await updateEmployee(employee.id, payload);
      } else {
        await createEmployee(payload);
      }
      onSave();
      onCancel();
    },
    validateOnBlur: true,
    validateOnChange: false,
  });

  // Update form when employee changes
  useEffect(() => {
    if (employee) {
      form.setValue("full_name", employee.full_name);
      form.setValue("role", employee.role);
      form.setValue("email", employee.email ?? "");
      form.setValue("rut", employee.rut ?? "");
      form.setValue("bank_name", employee.bank_name ?? "");
      form.setValue("bank_account_type", employee.bank_account_type ?? "");
      form.setValue("bank_account_number", employee.bank_account_number ?? "");
      form.setValue("salary_type", employee.salary_type ?? "hourly");
      form.setValue("hourly_rate", employee.hourly_rate ?? 0);
      form.setValue("fixed_salary", employee.fixed_salary ?? undefined);
      form.setValue("overtime_rate", employee.overtime_rate);
      form.setValue("retention_rate", employee.retention_rate);
    } else {
      form.reset();
    }
  }, [employee, form]);

  return (
    <form
      onSubmit={form.handleSubmit}
      className="space-y-4 rounded-2xl border border-[var(--brand-primary)]/15 bg-white p-6 text-sm shadow-sm"
    >
      <div className="grid gap-4 md:grid-cols-3">
        {form.values.salary_type === "fixed" && (
          <div className="col-span-3 flex items-center gap-2">
            <input
              type="checkbox"
              id="no-fixed-schedule"
              checked={form.values.no_fixed_schedule ?? false}
              onChange={(e) => form.setValue("no_fixed_schedule", e.target.checked)}
              className="mr-2"
            />
            <label htmlFor="no-fixed-schedule" className="text-xs font-semibold">
              No tiene horario fijo
            </label>
          </div>
        )}
        <div>
          <Input
            label="Nombre completo"
            type="text"
            {...form.getFieldProps("full_name")}
            value={typeof form.values.full_name === "boolean" ? "" : form.values.full_name}
            required
          />
          {form.getFieldError("full_name") && (
            <p className="mt-1 text-xs text-red-600">{form.getFieldError("full_name")}</p>
          )}
        </div>

        <div>
          <Input
            label="Cargo"
            type="text"
            {...form.getFieldProps("role")}
            value={typeof form.values.role === "boolean" ? "" : form.values.role}
            required
          />
          {form.getFieldError("role") && <p className="mt-1 text-xs text-red-600">{form.getFieldError("role")}</p>}
        </div>

        <div>
          <Input
            label="Correo"
            type="email"
            {...form.getFieldProps("email")}
            value={typeof form.values.email === "boolean" ? "" : form.values.email}
          />
          {form.getFieldError("email") && <p className="mt-1 text-xs text-red-600">{form.getFieldError("email")}</p>}
        </div>

        <div>
          <Input
            label="RUT"
            type="text"
            {...form.getFieldProps("rut")}
            value={typeof form.values.rut === "boolean" ? "" : form.values.rut}
            onBlur={(e: React.FocusEvent<HTMLInputElement>) => {
              const v = e.target.value.trim();
              if (v) form.setValue("rut", formatRut(normalizeRut(v) ?? v));
            }}
          />
        </div>
        <div>
          <Input
            label="Banco"
            type="text"
            {...form.getFieldProps("bank_name")}
            value={typeof form.values.bank_name === "boolean" ? "" : form.values.bank_name}
          />
        </div>
        <div>
          <Input
            label="Tipo de cuenta"
            type="select"
            value={form.values.bank_account_type || ""}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
              form.setValue("bank_account_type", e.target.value || "")
            }
          >
            <option value="">Selecciona…</option>
            <option value="RUT">RUT</option>
            <option value="VISTA">VISTA</option>
            <option value="CORRIENTE">CORRIENTE</option>
            <option value="AHORRO">AHORRO</option>
          </Input>
        </div>
        <div>
          <Input
            label="N° de cuenta"
            type="text"
            {...form.getFieldProps("bank_account_number")}
            value={typeof form.values.bank_account_number === "boolean" ? "" : form.values.bank_account_number}
          />
        </div>

        <div className="col-span-3">
          <label className="block text-xs font-semibold mb-1">Tipo de salario</label>
          <select
            className="w-full border rounded px-2 py-1 text-sm"
            value={form.values.salary_type}
            onChange={(e) => form.setValue("salary_type", e.target.value === "fixed" ? "fixed" : "hourly")}
          >
            <option value="hourly">Por hora</option>
            <option value="fixed">Sueldo fijo mensual</option>
          </select>
        </div>

        <div>
          <Input
            label="Tarifa por hora ($)"
            type="number"
            step="0.01"
            min="0"
            {...form.getFieldProps("hourly_rate")}
            value={typeof form.values.hourly_rate === "boolean" ? "" : form.values.hourly_rate}
            required={form.values.salary_type === "hourly"}
            disabled={form.values.salary_type !== "hourly"}
          />
          {form.getFieldError("hourly_rate") && (
            <p className="mt-1 text-xs text-red-600">{form.getFieldError("hourly_rate")}</p>
          )}
          {form.values.salary_type === "fixed" && (
            <Input
              label="Sueldo fijo mensual (CLP)"
              type="number"
              value={typeof form.values.fixed_salary === "boolean" ? "" : (form.values.fixed_salary ?? "")}
              onChange={(e) => form.setValue("fixed_salary", e.target.value)}
              required
            />
          )}
        </div>

        <div>
          <Input
            label="Tarifa horas extra ($)"
            type="number"
            step="0.01"
            min="0"
            {...form.getFieldProps("overtime_rate")}
            value={typeof form.values.overtime_rate === "boolean" ? "" : form.values.overtime_rate}
            placeholder="Opcional - dejar vacío si no aplica"
          />
          {form.getFieldError("overtime_rate") && (
            <p className="mt-1 text-xs text-red-600">{form.getFieldError("overtime_rate")}</p>
          )}
        </div>

        <div>
          <Input
            label="Tasa retención (0-1)"
            type="number"
            step="0.001"
            min="0"
            max="1"
            {...form.getFieldProps("retention_rate")}
            value={typeof form.values.retention_rate === "boolean" ? "" : form.values.retention_rate}
          />
          {form.getFieldError("retention_rate") && (
            <p className="mt-1 text-xs text-red-600">{form.getFieldError("retention_rate")}</p>
          )}
        </div>
      </div>

      {!form.isValid && Object.keys(form.errors).length > 0 && (
        <Alert variant="error">Por favor corrige los errores en el formulario antes de continuar.</Alert>
      )}

      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onCancel} disabled={form.isSubmitting}>
          Cancelar
        </Button>
        <Button type="submit" disabled={!canEdit || form.isSubmitting}>
          {form.isSubmitting ? "Guardando..." : employee ? "Actualizar" : "Crear"}
        </Button>
      </div>
    </form>
  );
}
