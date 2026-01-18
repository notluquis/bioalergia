import { getRetentionRateForYear } from "@shared/retention";
import { useMutation } from "@tanstack/react-query";
import React, { useEffect, useState } from "react";

import type { EmployeeSalaryType } from "@/types/schema";

import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { formatRut, normalizeRut, validateRut } from "@/lib/rut";

import type { Employee, EmployeePayload, EmployeeUpdatePayload } from "../types";

import { createEmployee, updateEmployee } from "../api";

interface EmployeeFormProps {
  employee?: Employee | null;
  onCancel: () => void;
  onSave: () => void;
}

export default function EmployeeForm({ employee, onCancel, onSave }: EmployeeFormProps) {
  const { can } = useAuth();
  const { error: toastError, success: toastSuccess } = useToast();

  // Determine required permission based on mode
  const isEditing = !!employee?.id;
  const hasPermission = isEditing ? can("update", "Employee") : can("create", "Employee");

  const [form, setForm] = useState<{
    bankAccountNumber: string;
    bankAccountType: string;
    bankName: string;
    email: string;
    fixedSalary: string;
    fullName: string;
    hourlyRate: string;
    overtimeRate: string;
    retentionRate: string;
    role: string;
    rut: string;
    salaryType: string;
  }>({
    bankAccountNumber: "",
    bankAccountType: "",
    bankName: "",
    email: "",
    fixedSalary: "",
    fullName: "",
    hourlyRate: "0",
    overtimeRate: "",
    retentionRate: "14.5",
    role: "",
    rut: "",
    salaryType: "HOURLY",
  });

  const [rutError, setRutError] = useState<null | string>(null);

  useEffect(() => {
    if (employee) {
      const employeeRate = getEmployeeRetentionRate(employee);
      const currentYearRate = getRetentionRateForYear(new Date().getFullYear());

      // If employee rate equals current year rate, show empty (auto mode)
      // Otherwise show the custom rate
      const rateToShow = Math.abs(employeeRate - currentYearRate) < 0.0001 ? "" : String(employeeRate * 100);

      setForm({
        bankAccountNumber: employee.bankAccountNumber ?? "",
        bankAccountType: employee.bankAccountType ?? "",
        bankName: employee.bankName ?? "",
        email: employee.person?.email ?? "",
        fixedSalary: employee.baseSalary == null ? "" : String(employee.baseSalary),
        fullName: employee.full_name,
        hourlyRate: String(employee.hourlyRate ?? "0"),
        overtimeRate: "", // Not in schema?
        retentionRate: rateToShow,
        role: employee.position,
        rut: employee.person?.rut ?? "",
        salaryType: employee.salaryType ?? "HOURLY",
      });
    } else {
      setForm({
        bankAccountNumber: "",
        bankAccountType: "",
        bankName: "",
        email: "",
        fixedSalary: "",
        fullName: "",
        hourlyRate: "0",
        overtimeRate: "",
        retentionRate: "", // Start empty for new employees (auto mode)
        role: "",
        rut: "",
        salaryType: "HOURLY",
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
        .map((i: { message: string; path: (number | string)[] }) => `${i.path.join(".")}: ${i.message}`)
        .join("\n");
      message = `Datos inválidos:\n${issues}`;
    }
    toastError(message);
  };

  // Mutation for creating employee
  const createMutation = useMutation({
    mutationFn: createEmployee,
    onError: (err) => {
      handleMutationError(err);
    },
    onSuccess: () => {
      toastSuccess("Empleado creado");
      onSave(); // Parent handles query invalidation via refetch (or we can invalidate here too)
      onCancel();
    },
  });

  // Mutation for updating employee
  const updateMutation = useMutation({
    mutationFn: (data: { id: number; payload: EmployeeUpdatePayload }) => updateEmployee(data.id, data.payload),
    onError: (err) => {
      handleMutationError(err);
    },
    onSuccess: () => {
      toastSuccess("Empleado actualizado");
      onSave();
      onCancel();
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
      bank_account_number: form.bankAccountNumber.trim() || null,
      bank_account_type: form.bankAccountType.trim() || null,
      bank_name: form.bankName.trim() || null,
      email: form.email.trim() || null,
      fixed_salary: form.salaryType === "FIXED" && form.fixedSalary ? Number(form.fixedSalary) : undefined,
      full_name: form.fullName.trim(),
      hourly_rate: form.salaryType === "HOURLY" && form.hourlyRate ? Number(form.hourlyRate) : undefined,
      overtime_rate: form.overtimeRate ? Number(form.overtimeRate) : null,
      // Convert percentage (e.g., 14.5) to decimal (0.145)
      // If empty/blank, use current year's default rate (auto mode)
      // Handle comma as decimal separator for Chilean format
      retention_rate: form.retentionRate.trim()
        ? Number(form.retentionRate.replace(",", ".")) / 100
        : getRetentionRateForYear(new Date().getFullYear()),
      role: form.role.trim(),
      rut: form.rut.trim() || null,
      salary_type: form.salaryType as EmployeeSalaryType,
    };

    if (employee?.id) {
      updateMutation.mutate({ id: employee.id, payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <div className="grid gap-4 md:grid-cols-3">
        <div className="md:col-span-3">
          <Input
            as="select"
            label="Tipo de salario"
            onChange={(event: React.ChangeEvent<HTMLSelectElement>) => {
              setForm((prev) => ({ ...prev, salaryType: event.target.value }));
            }}
            value={form.salaryType}
          >
            <option value="HOURLY">Por hora</option>
            <option value="FIXED">Sueldo fijo mensual</option>
          </Input>
        </div>
        <Input
          label="Nombre completo"
          onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
            setForm((prev) => ({ ...prev, fullName: event.target.value }));
          }}
          required
          type="text"
          value={form.fullName}
        />
        <Input
          label="Cargo"
          onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
            setForm((prev) => ({ ...prev, role: event.target.value }));
          }}
          required
          type="text"
          value={form.role}
        />
        <Input
          label="Correo"
          onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
            setForm((prev) => ({ ...prev, email: event.target.value }));
          }}
          placeholder="correo@bioalergia.cl"
          type="email"
          value={form.email}
        />
        <Input
          error={rutError || undefined}
          label="RUT"
          onBlur={handleRutBlur}
          onChange={handleRutChange}
          placeholder="12.345.678-9"
          type="text"
          value={form.rut}
        />
        <Input
          label="Banco"
          onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
            setForm((prev) => ({ ...prev, bankName: event.target.value }));
          }}
          placeholder="BancoEstado"
          type="text"
          value={form.bankName}
        />
        {/* Account type with datalist to avoid UI toggling */}
        <Input
          label="Tipo de cuenta"
          list="bank-account-type-options"
          onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
            setForm((prev) => ({ ...prev, bankAccountType: event.target.value }));
          }}
          placeholder="RUT / VISTA / CORRIENTE / AHORRO"
          type="text"
          value={form.bankAccountType}
        />
        <datalist id="bank-account-type-options">
          <option value="RUT" />
          <option value="VISTA" />
          <option value="CORRIENTE" />
          <option value="AHORRO" />
        </datalist>
        <Input
          label="N° de cuenta"
          onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
            setForm((prev) => ({ ...prev, bankAccountNumber: event.target.value }));
          }}
          placeholder="12345678"
          type="text"
          value={form.bankAccountNumber}
        />
        <Input
          disabled={form.salaryType !== "HOURLY"}
          label="Valor hora (CLP)"
          min="0"
          onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
            setForm((prev) => ({ ...prev, hourlyRate: event.target.value }));
          }}
          placeholder="$ 0"
          required={form.salaryType === "HOURLY"}
          type="number"
          value={form.hourlyRate}
        />
        {form.salaryType === "FIXED" && (
          <Input
            inputMode="numeric"
            label="Sueldo fijo mensual (CLP)"
            onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
              const rawValue = parseCLP(event.target.value);
              setForm((prev) => ({ ...prev, fixedSalary: rawValue }));
            }}
            placeholder="$ 1.500.000"
            required
            type="text"
            value={formatCLP(form.fixedSalary)}
          />
        )}
        <Input
          label="Valor hora extra (CLP)"
          min="0"
          onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
            setForm((prev) => ({ ...prev, overtimeRate: event.target.value }));
          }}
          placeholder="Opcional - dejar vacío si no aplica"
          type="number"
          value={form.overtimeRate}
        />
        <Input
          helper="Dejar vacío para usar tasa por año: 2025=14,5% | 2026=15,25%. Si se ingresa un valor, este se aplica para TODOS los años."
          inputMode="decimal"
          label="Retención (%) - Personalizada"
          onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
            // Allow digits, dots, and commas for decimal input
            const value = event.target.value.replaceAll(/[^\d.,]/g, "");
            setForm((prev) => ({ ...prev, retentionRate: value }));
          }}
          placeholder="Ej: 14.5 (opcional - usa tasa por año si está vacío)"
          type="text"
          value={form.retentionRate}
        />
      </div>
      <div className="flex items-center justify-end gap-3">
        <Button onClick={onCancel} type="button" variant="secondary">
          Cancelar
        </Button>
        <Button disabled={isMutating} type="submit">
          {(() => {
            if (isMutating) return "Guardando...";
            return isEditing ? "Actualizar empleado" : "Agregar empleado";
          })()}
        </Button>
      </div>
    </form>
  );
}

// CLP currency formatting helpers
function formatCLP(value: number | string): string {
  const num = typeof value === "string" ? Number.parseFloat(value.replaceAll(".", "").replaceAll(",", "")) : value;
  if (Number.isNaN(num) || num === 0) return "";
  return num.toLocaleString("es-CL");
}

// Helper to safely extract retention rate from employee object
function getEmployeeRetentionRate(employee: Employee): number {
  // Try both property naming conventions due to ZenStack type inconsistencies
  const emp = employee as unknown as Record<string, unknown>;
  const rate = emp.retentionRate ?? emp.retention_rate;
  return typeof rate === "number" ? rate : getRetentionRateForYear(new Date().getFullYear());
}

function parseCLP(formatted: string): string {
  // Remove thousands separators (dots in Chilean format)
  return formatted.replaceAll(".", "");
}
