import {
  Button,
  Description,
  FieldError,
  Form,
  Input,
  Label,
  ListBox,
  Select,
  TextField,
} from "@heroui/react";
import { useMutation } from "@tanstack/react-query";
import type React from "react";
import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { formatRut, normalizeRut, validateRut } from "@/lib/rut";
import type { EmployeeSalaryType } from "@/types/schema";
import { getRetentionRateForYear } from "~/shared/retention";
import { createEmployee, updateEmployee } from "../api";
import type { Employee, EmployeePayload, EmployeeUpdatePayload } from "../types";

interface EmployeeFormProps {
  employee?: Employee | null;
  onCancel: () => void;
  onSave: () => void;
}

type EmployeeFormState = {
  bankAccountNumber: string;
  bankAccountType: string;
  bankName: string;
  email: string;
  firstLastName: string;
  fixedSalary: string;
  hourlyRate: string;
  names: string;
  overtimeRate: string;
  retentionRate: string;
  role: string;
  rut: string;
  secondLastName: string;
  salaryType: string;
};

const EMPTY_EMPLOYEE_FORM: EmployeeFormState = {
  bankAccountNumber: "",
  bankAccountType: "",
  bankName: "",
  email: "",
  firstLastName: "",
  fixedSalary: "",
  hourlyRate: "0",
  names: "",
  overtimeRate: "",
  retentionRate: "",
  role: "",
  rut: "",
  secondLastName: "",
  salaryType: "HOURLY",
};

const buildEmployeeFormState = (employee?: Employee | null): EmployeeFormState => {
  if (!employee) {
    return { ...EMPTY_EMPLOYEE_FORM };
  }

  const employeeRate = getEmployeeRetentionRate(employee);
  const currentYearRate = getRetentionRateForYear(new Date().getFullYear());
  const rateToShow =
    Math.abs(employeeRate - currentYearRate) < 0.0001 ? "" : String(employeeRate * 100);

  return {
    bankAccountNumber: employee.bankAccountNumber ?? "",
    bankAccountType: employee.bankAccountType ?? "",
    bankName: employee.bankName ?? "",
    email: employee.person?.email ?? "",
    firstLastName: employee.person?.fatherName ?? "",
    fixedSalary: employee.baseSalary == null ? "" : String(employee.baseSalary),
    hourlyRate: String(employee.hourlyRate ?? "0"),
    names: employee.person?.names ?? "",
    overtimeRate: "",
    retentionRate: rateToShow,
    role: employee.position,
    rut: employee.person?.rut ?? "",
    secondLastName: employee.person?.motherName ?? "",
    salaryType: employee.salaryType ?? "HOURLY",
  };
};

const buildEmployeePayload = (form: EmployeeFormState): EmployeePayload => {
  return {
    bank_account_number: form.bankAccountNumber.trim() || null,
    bank_account_type: form.bankAccountType.trim() || null,
    bank_name: form.bankName.trim() || null,
    email: form.email.trim() || null,
    fatherName: form.firstLastName.trim() || null,
    fixed_salary:
      form.salaryType === "FIXED" && form.fixedSalary ? Number(form.fixedSalary) : undefined,
    hourly_rate:
      form.salaryType === "HOURLY" && form.hourlyRate ? Number(form.hourlyRate) : undefined,
    motherName: form.secondLastName.trim() || null,
    names: form.names.trim(),
    overtime_rate: form.overtimeRate ? Number(form.overtimeRate) : null,
    retention_rate: form.retentionRate.trim()
      ? Number(form.retentionRate.replace(",", ".")) / 100
      : getRetentionRateForYear(new Date().getFullYear()),
    role: form.role.trim(),
    rut: form.rut.trim() || null,
    salary_type: form.salaryType as EmployeeSalaryType,
  };
};

export function EmployeeForm({ employee, onCancel, onSave }: EmployeeFormProps) {
  const { can } = useAuth();
  const { error: toastError, success: toastSuccess } = useToast();

  // Determine required permission based on mode
  const isEditing = Boolean(employee?.id);
  const hasPermission = isEditing ? can("update", "Employee") : can("create", "Employee");

  const [form, setForm] = useState<EmployeeFormState>({
    ...EMPTY_EMPLOYEE_FORM,
    retentionRate: "14.5",
  });

  const [rutError, setRutError] = useState<null | string>(null);
  useEffect(() => {
    setForm(buildEmployeeFormState(employee));
    setRutError(null);
  }, [employee]);

  const handleRutChange = (value: string) => {
    setForm((prev) => ({ ...prev, rut: value }));
    if (rutError) {
      setRutError(null);
    }
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
        .map(
          (i: { message: string; path: (number | string)[] }) => `${i.path.join(".")}: ${i.message}`
        )
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
    mutationFn: (data: { id: number; payload: EmployeeUpdatePayload }) =>
      updateEmployee(data.id, data.payload),
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
    if (!hasPermission) {
      return;
    }

    // Validate RUT before submit if present
    if (form.rut && !validateRut(form.rut)) {
      setRutError("RUT inválido");
      return;
    }

    const payload = buildEmployeePayload(form);

    if (employee?.id) {
      updateMutation.mutate({ id: employee.id, payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  return (
    <EmployeeFormContent
      form={form}
      handleRutBlur={handleRutBlur}
      handleRutChange={handleRutChange}
      isEditing={isEditing}
      isMutating={isMutating}
      onCancel={onCancel}
      onSubmit={handleSubmit}
      setForm={setForm}
      rutError={rutError}
    />
  );
}

function EmployeeFormContent({
  form,
  handleRutBlur,
  handleRutChange,
  isEditing,
  isMutating,
  onCancel,
  onSubmit,
  setForm,
  rutError,
}: {
  form: {
    bankAccountNumber: string;
    bankAccountType: string;
    bankName: string;
    email: string;
    firstLastName: string;
    fixedSalary: string;
    hourlyRate: string;
    names: string;
    overtimeRate: string;
    retentionRate: string;
    role: string;
    rut: string;
    secondLastName: string;
    salaryType: string;
  };
  handleRutBlur: () => void;
  handleRutChange: (value: string) => void;
  isEditing: boolean;
  isMutating: boolean;
  onCancel: () => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  setForm: React.Dispatch<
    React.SetStateAction<{
      bankAccountNumber: string;
      bankAccountType: string;
      bankName: string;
      email: string;
      firstLastName: string;
      fixedSalary: string;
      hourlyRate: string;
      names: string;
      overtimeRate: string;
      retentionRate: string;
      role: string;
      rut: string;
      secondLastName: string;
      salaryType: string;
    }>
  >;
  rutError: null | string;
}) {
  return (
    <Form className="space-y-4" onSubmit={onSubmit} validationBehavior="aria">
      <div className="grid gap-4 md:grid-cols-3">
        <div className="md:col-span-3">
          <Select
            onChange={(key) => {
              if (!key) {
                return;
              }
              setForm((prev) => ({ ...prev, salaryType: String(key) }));
            }}
            value={form.salaryType}
          >
            <Label>Tipo de salario</Label>
            <Select.Trigger>
              <Select.Value />
              <Select.Indicator />
            </Select.Trigger>
            <Select.Popover>
              <ListBox>
                <ListBox.Item id="HOURLY" key="HOURLY">
                  Por hora
                </ListBox.Item>
                <ListBox.Item id="FIXED" key="FIXED">
                  Sueldo fijo mensual
                </ListBox.Item>
              </ListBox>
            </Select.Popover>
          </Select>
        </div>
        <TextField
          isRequired
          type="text"
          value={form.names}
          onChange={(v) => setForm((prev) => ({ ...prev, names: v }))}
        >
          <Label>Nombres</Label>
          <Input />
        </TextField>

        <TextField
          type="text"
          value={form.firstLastName}
          onChange={(v) => setForm((prev) => ({ ...prev, firstLastName: v }))}
        >
          <Label>Primer apellido</Label>
          <Input />
        </TextField>

        <TextField
          type="text"
          value={form.secondLastName}
          onChange={(v) => setForm((prev) => ({ ...prev, secondLastName: v }))}
        >
          <Label>Segundo apellido</Label>
          <Input />
        </TextField>

        <TextField
          isRequired
          type="text"
          value={form.role}
          onChange={(v) => setForm((prev) => ({ ...prev, role: v }))}
        >
          <Label>Cargo</Label>
          <Input />
        </TextField>

        <TextField
          type="email"
          value={form.email}
          onChange={(v) => setForm((prev) => ({ ...prev, email: v }))}
        >
          <Label>Correo</Label>
          <Input placeholder="correo@bioalergia.cl" />
        </TextField>

        <TextField
          isInvalid={Boolean(rutError)}
          type="text"
          value={form.rut}
          onChange={handleRutChange}
        >
          <Label>RUT</Label>
          <Input onBlur={handleRutBlur} placeholder="12.345.678-9" />
          {rutError ? <FieldError>{rutError}</FieldError> : null}
        </TextField>

        <TextField
          type="text"
          value={form.bankName}
          onChange={(v) => setForm((prev) => ({ ...prev, bankName: v }))}
        >
          <Label>Banco</Label>
          <Input placeholder="BancoEstado" />
        </TextField>

        <TextField
          type="text"
          value={form.bankAccountType}
          onChange={(v) => setForm((prev) => ({ ...prev, bankAccountType: v }))}
        >
          <Label>Tipo de cuenta</Label>
          <Input list="bank-account-type-options" placeholder="RUT / VISTA / CORRIENTE / AHORRO" />
        </TextField>

        <datalist id="bank-account-type-options">
          <option value="RUT" />
          <option value="VISTA" />
          <option value="CORRIENTE" />
          <option value="AHORRO" />
        </datalist>
        <TextField
          type="text"
          value={form.bankAccountNumber}
          onChange={(v) => setForm((prev) => ({ ...prev, bankAccountNumber: v }))}
        >
          <Label>N° de cuenta</Label>
          <Input placeholder="12345678" />
        </TextField>

        <TextField
          isDisabled={form.salaryType !== "HOURLY"}
          isRequired={form.salaryType === "HOURLY"}
          type="number"
          value={form.hourlyRate}
          onChange={(v) => setForm((prev) => ({ ...prev, hourlyRate: v }))}
        >
          <Label>Valor hora (CLP)</Label>
          <Input min="0" placeholder="$ 0" />
        </TextField>

        {form.salaryType === "FIXED" && (
          <TextField
            isRequired
            type="text"
            value={formatCLP(form.fixedSalary)}
            onChange={(v) => setForm((prev) => ({ ...prev, fixedSalary: parseCLP(v) }))}
          >
            <Label>Sueldo fijo mensual (CLP)</Label>
            <Input inputMode="numeric" min="0" placeholder="$ 1.500.000" />
          </TextField>
        )}
        <TextField
          type="number"
          value={form.overtimeRate}
          onChange={(v) => setForm((prev) => ({ ...prev, overtimeRate: v }))}
        >
          <Label>Valor hora extra (CLP)</Label>
          <Input min="0" placeholder="Opcional - dejar vacío si no aplica" />
        </TextField>

        <TextField
          type="text"
          value={form.retentionRate}
          onChange={(v) => {
            const filtered = v.replaceAll(/[^\d.,]/g, "");
            setForm((prev) => ({ ...prev, retentionRate: filtered }));
          }}
        >
          <Label>Retención (%) - Personalizada</Label>
          <Input
            inputMode="decimal"
            placeholder="Ej: 14.5 (opcional - usa tasa por año si está vacío)"
          />
          <Description>
            Dejar vacío para usar tasa por año: 2025=14,5% | 2026=15,25%. Si se ingresa un valor,
            este se aplica para TODOS los años.
          </Description>
        </TextField>
      </div>
      <div className="flex items-center justify-end gap-3">
        <Button onPress={onCancel} type="button" variant="secondary">
          Cancelar
        </Button>
        <Button isDisabled={isMutating} type="submit">
          {isMutating ? "Guardando..." : isEditing ? "Actualizar empleado" : "Agregar empleado"}
        </Button>
      </div>
    </Form>
  );
}

// CLP currency formatting helpers
function formatCLP(value: number | string): string {
  const num =
    typeof value === "string"
      ? Number.parseFloat(value.replaceAll(".", "").replaceAll(",", ""))
      : value;
  if (Number.isNaN(num) || num === 0) {
    return "";
  }
  return num.toLocaleString("es-CL");
}

function getEmployeeRetentionRate(employee: Employee): number {
  const emp = employee as unknown as Record<string, unknown>;
  const rate = emp.retentionRate ?? emp.retention_rate;
  return typeof rate === "number" ? rate : getRetentionRateForYear(new Date().getFullYear());
}

function parseCLP(formatted: string): string {
  // Remove thousands separators (dots in Chilean format)
  return formatted.replaceAll(".", "");
}
