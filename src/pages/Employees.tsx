import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { fetchEmployees, deactivateEmployee, updateEmployee } from "../features/employees/api";
import type { Employee } from "../features/employees/types";
import EmployeeForm from "../features/employees/components/EmployeeForm";
import EmployeeTable from "../features/employees/components/EmployeeTable";
import Alert from "../components/Alert";
import Input from "../components/Input";

export default function EmployeesPage() {
  const { hasRole } = useAuth();
  const canEdit = hasRole("GOD", "ADMIN");

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [includeInactive, setIncludeInactive] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);

  useEffect(() => {
    loadEmployees();
  }, [includeInactive]);

  async function loadEmployees() {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchEmployees(includeInactive);
      setEmployees(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : "No se pudieron cargar los empleados";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  async function handleDeactivate(id: number) {
    if (!canEdit) return;
    setLoading(true);
    setError(null);
    try {
      await deactivateEmployee(id);
      await loadEmployees();
    } catch (err) {
      const message = err instanceof Error ? err.message : "No se pudo actualizar el estado";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  async function handleActivate(id: number) {
    if (!canEdit) return;
    setLoading(true);
    setError(null);
    try {
      await updateEmployee(id, { status: "ACTIVE" });
      await loadEmployees();
    } catch (err) {
      const message = err instanceof Error ? err.message : "No se pudo actualizar el estado";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-[var(--brand-primary)]">Equipo y tarifas</h1>
          <p className="max-w-2xl text-sm text-slate-600">
            Registra trabajadores, correos y tarifas para calcular automáticamente los totales mensuales.
          </p>
        </div>
        <Input
          type="checkbox"
          checked={includeInactive}
          onChange={(event) => setIncludeInactive(event.target.checked)}
          label="Ver inactivos"
          className="w-fit"
        />
      </div>

      {error && <Alert variant="error">{error}</Alert>}

      {canEdit && (
        <EmployeeForm employee={editingEmployee} onSave={loadEmployees} onCancel={() => setEditingEmployee(null)} />
      )}

      <EmployeeTable
        employees={employees}
        loading={loading}
        onEdit={setEditingEmployee}
        onDeactivate={handleDeactivate}
        onActivate={handleActivate}
      />
    </section>
  );
}
