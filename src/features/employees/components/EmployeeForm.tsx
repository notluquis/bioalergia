import React, { useEffect, useState } from "react";
import { useAuth } from "../../../context/AuthContext";
import { createEmployee, updateEmployee } from "../api";
import type { Employee } from "../types";
import Button from "../../../components/Button";
import Input from "../../../components/Input";
import Alert from "../../../components/Alert";
import { formatRut, normalizeRut } from "../../../lib/rut";

const EMPTY_FORM = {
  full_name: "",
  role: "",
  email: "",
  rut: "",
  bank_name: "",
  bank_account_type: "",
  bank_account_number: "",
  salary_type: "hourly",
  hourly_rate: "0",
  fixed_salary: "",
  overtime_rate: "",
  retention_rate: "0.145",
};

interface EmployeeFormProps {
  employee?: Employee | null;
  onSave: () => void;
  onCancel: () => void;
}

export default function EmployeeForm({ employee, onSave, onCancel }: EmployeeFormProps) {
  const { hasRole } = useAuth();
  const canEdit = hasRole("GOD", "ADMIN");

  const [form, setForm] = useState(EMPTY_FORM);
  // no-op
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (employee) {
      setForm({
        full_name: employee.full_name,
        role: employee.role,
        email: employee.email ?? "",
        rut: employee.rut ?? "",
        bank_name: employee.bank_name ?? "",
        bank_account_type: employee.bank_account_type ?? "",
        bank_account_number: employee.bank_account_number ?? "",
        salary_type: employee.salary_type ?? "hourly",
        hourly_rate: String(employee.hourly_rate ?? "0"),
        fixed_salary: employee.fixed_salary != null ? String(employee.fixed_salary) : "",
        overtime_rate: employee.overtime_rate != null ? String(employee.overtime_rate) : "",
        retention_rate: String(employee.retention_rate),
      });
    } else {
      setForm(EMPTY_FORM);
    }
  }, [employee]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canEdit) return;

    const payload = {
      full_name: form.full_name.trim(),
      role: form.role.trim(),
      email: form.email.trim() || null,
      rut: form.rut.trim() || null,
      bank_name: form.bank_name.trim() || null,
      bank_account_type: form.bank_account_type.trim() || null,
      bank_account_number: form.bank_account_number.trim() || null,
      salary_type: form.salary_type === "fixed" ? "fixed" : ("hourly" as "hourly" | "fixed"),
      hourly_rate: form.salary_type === "hourly" ? Number(form.hourly_rate || 0) : undefined,
      fixed_salary: form.salary_type === "fixed" ? Number(form.fixed_salary || 0) : undefined,
      overtime_rate: form.overtime_rate ? Number(form.overtime_rate) : null,
      retention_rate: Number(form.retention_rate || 0),
    };
    setSaving(true);
    setError(null);
    try {
      if (employee?.id) {
        await updateEmployee(employee.id, payload);
      } else {
        await createEmployee(payload);
      }
      onSave();
      onCancel();
    } catch (err) {
      const message = err instanceof Error ? err.message : "No se pudo guardar el empleado";
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4 rounded-2xl border border-[var(--brand-primary)]/15 bg-white p-6 text-sm shadow-sm"
    >
      <div className="grid gap-4 md:grid-cols-3">
        <div className="col-span-3">
          <label className="block text-xs font-semibold mb-1">Tipo de salario</label>
          <select
            className="w-full border rounded px-2 py-1 text-sm"
            value={form.salary_type}
            onChange={(e) => setForm((prev) => ({ ...prev, salary_type: e.target.value }))}
          >
            <option value="hourly">Por hora</option>
            <option value="fixed">Sueldo fijo mensual</option>
          </select>
        </div>
        <Input
          label="Nombre completo"
          type="text"
          value={form.full_name}
          onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
            setForm((prev) => ({ ...prev, full_name: event.target.value }))
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
        {form.rut && normalizeRut(form.rut) === null && (
          <span className="text-xs text-red-600">RUT inválido (se formatea al salir del campo)</span>
        )}
        <Input
          label="Banco"
          type="text"
          value={form.bank_name}
          onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
            setForm((prev) => ({ ...prev, bank_name: event.target.value }))
          }
          placeholder="BancoEstado"
        />
        {/* Account type with datalist to avoid UI toggling */}
        <Input
          label="Tipo de cuenta"
          type="text"
          value={form.bank_account_type}
          list="bank-account-type-options"
          onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
            setForm((prev) => ({ ...prev, bank_account_type: event.target.value }))
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
          value={form.bank_account_number}
          onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
            setForm((prev) => ({ ...prev, bank_account_number: event.target.value }))
          }
          placeholder="12345678"
        />
        <Input
          label="Valor hora (CLP)"
          type="number"
          min="0"
          value={form.hourly_rate}
          onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
            setForm((prev) => ({ ...prev, hourly_rate: event.target.value }))
          }
          required={form.salary_type === "hourly"}
          disabled={form.salary_type !== "hourly"}
        />
        {form.salary_type === "fixed" && (
          <Input
            label="Sueldo fijo mensual (CLP)"
            type="number"
            min="0"
            value={form.fixed_salary}
            onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
              setForm((prev) => ({ ...prev, fixed_salary: event.target.value }))
            }
            required
          />
        )}
        <Input
          label="Valor hora extra (CLP)"
          type="number"
          min="0"
          value={form.overtime_rate}
          onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
            setForm((prev) => ({ ...prev, overtime_rate: event.target.value }))
          }
          placeholder="Opcional - dejar vacío si no aplica"
        />
        <Input
          label="Retención (%)"
          type="number"
          min="0"
          max="1"
          step="0.001"
          value={form.retention_rate}
          onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
            setForm((prev) => ({ ...prev, retention_rate: event.target.value }))
          }
          required
          helper="Ej: 0.145 para 14.5%"
        />
      </div>
      {error && <Alert variant="error">{error}</Alert>}
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={saving}>
          {saving ? "Guardando..." : employee?.id ? "Actualizar" : "Agregar"}
        </Button>
        {employee?.id && (
          <Button type="button" variant="secondary" onClick={onCancel}>
            Cancelar edición
          </Button>
        )}
      </div>
    </form>
  );
}
