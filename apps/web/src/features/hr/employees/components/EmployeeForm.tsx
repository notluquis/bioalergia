import { useMutation } from "@tanstack/react-query";
import React, { useEffect, useState } from "react";

import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { formatRut, normalizeRut, validateRut } from "@/lib/rut";
import type { EmployeeSalaryType } from "@/types/schema";

import { createEmployee, updateEmployee } from "../api";
import type { Employee, EmployeePayload, EmployeeUpdatePayload } from "../types";

// CLP currency formatting helpers
function formatCLP(value: string | number): string {
  const num = typeof value === "string" ? parseFloat(value.replace(/\./g, "").replace(/,/g, "")) : value;
  if (isNaN(num) || num === 0) return "";
  return num.toLocaleString("es-CL");
}

function parseCLP(formatted: string): string {
  // Remove thousands separators (dots in Chilean format)
  return formatted.replace(/\./g, "");
}

interface EmployeeFormProps {
  employee?: Employee | null;
  onSave: () => void;
  onCancel: () => void;
}

export default function EmployeeForm({ employee, onSave, onCancel }: EmployeeFormProps) {
  const { can } = useAuth();
  const { error: toastError, success: toastSuccess } = useToast();

  // Determine required permission based on mode
  const isEditing = !!employee?.id;
  const hasPermission = isEditing ? can("update", "Employee") : can("create", "Employee");

  const [form, setForm] = useState<{
    fullName: string;
    role: string;
    email: string;
    rut: string;
    bankName: string;
    bankAccountType: string;
    bankAccountNumber: string;
    salaryType: string;
    hourlyRate: string;
    fixedSalary: string;
    overtimeRate: string;
    retentionRate: string;
  }>({
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
    retentionRate: "14.5",
  });

  const [rutError, setRutError] = useState<string | null>(null);

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
        retentionRate: "14.5", // Default 14.5%
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
    // Clear RUT error on employee change
    setRutError(null);
  }, [employee]);

  const handleRutChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    setForm((prev) => ({ ...prev, rut: value }));
    if (rutError) setRutError(null);
  };

  const handleRutBlur = () => {
    const formatted = formatRut(normalizeRut(form.rut) ?? form.rut);
    setForm((prev) => ({ ...prev, rut: formatted }));

    if (formatted && !validateRut(formatted)) {
      setRutError("RUT inválido");
    }
  };

  const handleMutationError = (err: unknown) => {
    const errObj = err as { details?: unknown; message?: string };
    const details = errObj.details;
    let message = err instanceof Error ? err.message : "No se pudo guardar el empleado";

    if (Array.isArray(details)) {
      const issues = details
        .map((i: { path: (string | number)[]; message: string }) => `${i.path.join(".")}: ${i.message}`)
        .join("\n");
      message = `Datos inválidos:\n${issues}`;
    }
    toastError(message);
  };

  // Mutation for creating employee
  const createMutation = useMutation({
    mutationFn: createEmployee,
    onSuccess: () => {
      toastSuccess("Empleado creado");
      onSave(); // Parent handles query invalidation via refetch (or we can invalidate here too)
      onCancel();
    },
    onError: (err) => {
      handleMutationError(err);
    },
  });

  // Mutation for updating employee
  const updateMutation = useMutation({
    mutationFn: (data: { id: number; payload: EmployeeUpdatePayload }) => updateEmployee(data.id, data.payload),
    onSuccess: () => {
      toastSuccess("Empleado actualizado");
      onSave();
      onCancel();
    },
    onError: (err) => {
      handleMutationError(err);
    },
  });

  const isMutating = createMutation.isPending || updateMutation.isPending;

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!hasPermission) return;

    // Validate RUT before submit if present
    if (form.rut && !validateRut(form.rut)) {
      setRutError("RUT inválido");
      return;
    }

    const payload: EmployeePayload = {
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
      // Convert percentage (e.g., 14.5) to decimal (0.145)
      // Handle comma as decimal separator for Chilean format
      retention_rate: form.retentionRate ? Number(form.retentionRate.replace(",", ".")) / 100 : 0,
    };

    if (employee?.id) {
      updateMutation.mutate({ id: employee.id, payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
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
          onChange={handleRutChange}
          onBlur={handleRutBlur}
          error={rutError || undefined}
          placeholder="12.345.678-9"
        />
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
            type="text"
            inputMode="numeric"
            value={formatCLP(form.fixedSalary)}
            onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
              const rawValue = parseCLP(event.target.value);
              setForm((prev) => ({ ...prev, fixedSalary: rawValue }));
            }}
            required
            placeholder="$ 1.500.000"
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
          type="text"
          inputMode="decimal"
          value={form.retentionRate}
          onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
            // Allow digits, dots, and commas for decimal input
            const value = event.target.value.replace(/[^\d.,]/g, "");
            setForm((prev) => ({ ...prev, retentionRate: value }));
          }}
          required
          helper="Ej: 14.5 o 14,5 para 14.5%"
        />
      </div>
      <div className="flex items-center justify-end gap-3">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" disabled={isMutating}>
          {isMutating ? "Guardando..." : employee?.id ? "Actualizar empleado" : "Agregar empleado"}
        </Button>
      </div>
    </form>
  );
}
