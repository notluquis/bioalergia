import React, { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { createEmployee, updateEmployee } from "../api";
import type { Employee } from "../types";
import type { EmployeeSalaryType } from "@/types/schema";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { formatRut, normalizeRut, validateRut } from "@/lib/rut";

interface EmployeeFormProps {
  employee?: Employee | null;
  onSave: () => void;
  onCancel: () => void;
}

export default function EmployeeForm({ employee, onSave, onCancel }: EmployeeFormProps) {
  const { hasRole } = useAuth();
  const { error: toastError, success: toastSuccess } = useToast();
  const canEdit = hasRole("GOD", "ADMIN");

  const [form, setForm] = useState({
    fullName: "",
    role: "",
    email: "",
    rut: "",
    bankName: "",
    bankAccountType: "",
    bankAccountNumber: "",
    salaryType: "HOURLY",
    hourlyRate: "0",
    fixedSalary: "",
    overtimeRate: "",
    retentionRate: "0.145",
  });
  // no-op
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (employee) {
      setForm({
        fullName: employee.full_name,
        role: employee.position,
        email: employee.person?.email ?? "",
        rut: employee.person?.rut ?? "",
        bankName: employee.bankName ?? "",
        bankAccountType: employee.bankAccountType ?? "",
        bankAccountNumber: employee.bankAccountNumber ?? "",
        salaryType: employee.salaryType ?? "HOURLY",
        hourlyRate: String(employee.hourlyRate ?? "0"),
        fixedSalary: employee.baseSalary != null ? String(employee.baseSalary) : "",
        overtimeRate: "", // Not in schema?
        retentionRate: "0.145", // Not in schema?
      });
    } else {
      setForm({
        fullName: "",
        role: "",
        email: "",
        rut: "",
        bankName: "",
        bankAccountType: "",
        bankAccountNumber: "",
        salaryType: "HOURLY",
        hourlyRate: "0",
        fixedSalary: "",
        overtimeRate: "",
        retentionRate: "0.145",
      });
    }
  }, [employee]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canEdit) return;

    const payload = {
      full_name: form.fullName.trim(),
      role: form.role.trim(),
      email: form.email.trim() || null,
      rut: form.rut.trim() || null,
      bank_name: form.bankName.trim() || null,
      bank_account_type: form.bankAccountType.trim() || null,
      bank_account_number: form.bankAccountNumber.trim() || null,
      salary_type: form.salaryType as EmployeeSalaryType,
      hourly_rate: form.salaryType === "HOURLY" && form.hourlyRate ? Number(form.hourlyRate) : undefined,
      fixed_salary: form.salaryType === "FIXED" && form.fixedSalary ? Number(form.fixedSalary) : undefined,
      overtime_rate: form.overtimeRate ? Number(form.overtimeRate) : null,
      retention_rate: form.retentionRate ? Number(form.retentionRate) : 0,
    };
    setSaving(true);
    try {
      if (employee?.id) {
        await updateEmployee(employee.id, payload);
        toastSuccess("Empleado actualizado");
      } else {
        await createEmployee(payload);
        toastSuccess("Empleado creado");
      }
      onSave();
      onCancel();
    } catch (err) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const details = (err as any).details;
      let message = err instanceof Error ? err.message : "No se pudo guardar el empleado";

      if (Array.isArray(details)) {
        // It's a Zod issue array
        const issues = details
          .map((i: { path: (string | number)[]; message: string }) => `${i.path.join(".")}: ${i.message}`)
          .join("\n");
        message = `Datos inválidos:\n${issues}`;
      }

      toastError(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4 rounded-2xl border border-primary/15 bg-base-100 p-6 text-sm shadow-sm"
    >
      <div className="grid gap-4 md:grid-cols-3">
        <div className="md:col-span-3">
          <Input
            label="Tipo de salario"
            as="select"
            value={form.salaryType}
            onChange={(event: React.ChangeEvent<HTMLSelectElement>) =>
              setForm((prev) => ({ ...prev, salaryType: event.target.value }))
            }
          >
            <option value="HOURLY">Por hora</option>
            <option value="FIXED">Sueldo fijo mensual</option>
          </Input>
        </div>
        <Input
          label="Nombre completo"
          type="text"
          value={form.fullName}
          onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
            setForm((prev) => ({ ...prev, fullName: event.target.value }))
          }
          required
        />
        <Input
          label="Cargo"
          type="text"
          value={form.role}
          onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
            setForm((prev) => ({ ...prev, role: event.target.value }))
          }
          required
        />
        <Input
          label="Correo"
          type="email"
          value={form.email}
          onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
            setForm((prev) => ({ ...prev, email: event.target.value }))
          }
          placeholder="correo@bioalergia.cl"
        />
        <Input
          label="RUT"
          type="text"
          value={form.rut}
          onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
            setForm((prev) => ({ ...prev, rut: event.target.value }))
          }
          onBlur={() => setForm((prev) => ({ ...prev, rut: formatRut(normalizeRut(prev.rut) ?? prev.rut) }))}
          placeholder="12.345.678-9"
        />
        {form.rut && !validateRut(form.rut) && (
          <span className="text-xs text-red-600">RUT inválido (se formatea al salir del campo)</span>
        )}
        <Input
          label="Banco"
          type="text"
          value={form.bankName}
          onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
            setForm((prev) => ({ ...prev, bankName: event.target.value }))
          }
          placeholder="BancoEstado"
        />
        {/* Account type with datalist to avoid UI toggling */}
        <Input
          label="Tipo de cuenta"
          type="text"
          value={form.bankAccountType}
          list="bank-account-type-options"
          onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
            setForm((prev) => ({ ...prev, bankAccountType: event.target.value }))
          }
          placeholder="RUT / VISTA / CORRIENTE / AHORRO"
        />
        <datalist id="bank-account-type-options">
          <option value="RUT" />
          <option value="VISTA" />
          <option value="CORRIENTE" />
          <option value="AHORRO" />
        </datalist>
        <Input
          label="N° de cuenta"
          type="text"
          value={form.bankAccountNumber}
          onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
            setForm((prev) => ({ ...prev, bankAccountNumber: event.target.value }))
          }
          placeholder="12345678"
        />
        <Input
          label="Valor hora (CLP)"
          type="number"
          min="0"
          value={form.hourlyRate}
          onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
            setForm((prev) => ({ ...prev, hourlyRate: event.target.value }))
          }
          required={form.salaryType === "HOURLY"}
          disabled={form.salaryType !== "HOURLY"}
          placeholder="$ 0"
        />
        {form.salaryType === "FIXED" && (
          <Input
            label="Sueldo fijo mensual (CLP)"
            type="number"
            min="0"
            value={form.fixedSalary}
            onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
              setForm((prev) => ({ ...prev, fixedSalary: event.target.value }))
            }
            required
            placeholder="$ 0"
          />
        )}
        <Input
          label="Valor hora extra (CLP)"
          type="number"
          min="0"
          value={form.overtimeRate}
          onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
            setForm((prev) => ({ ...prev, overtimeRate: event.target.value }))
          }
          placeholder="Opcional - dejar vacío si no aplica"
        />
        <Input
          label="Retención (%)"
          type="number"
          min="0"
          max="1"
          step="0.001"
          value={form.retentionRate}
          onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
            setForm((prev) => ({ ...prev, retentionRate: event.target.value }))
          }
          required
          helper="Ej: 0.145 para 14.5%"
        />
      </div>
      <div className="flex items-center justify-end gap-3">
        {employee?.id && (
          <Button type="button" variant="secondary" onClick={onCancel}>
            Cancelar edición
          </Button>
        )}
        <Button type="submit" disabled={saving}>
          {saving ? "Guardando..." : employee?.id ? "Actualizar" : "Agregar"}
        </Button>
      </div>
    </form>
  );
}
