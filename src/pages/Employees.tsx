import { useCallback, useEffect, useState } from "react";
import type { ChangeEvent } from "react";
import { useAuth } from "../context/AuthContext";
import { fetchEmployees, deactivateEmployee, updateEmployee } from "../features/employees/api";
import type { Employee } from "../features/employees/types";
import EmployeeForm from "../features/employees/components/EmployeeForm";
import EmployeeTable from "../features/employees/components/EmployeeTable";
import Alert from "../components/ui/Alert";
import Checkbox from "../components/ui/Checkbox";

export default function EmployeesPage() {
  const { hasRole } = useAuth();
  const canEdit = hasRole("GOD", "ADMIN");

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [includeInactive, setIncludeInactive] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);

  const loadEmployees = useCallback(async () => {
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
  }, [includeInactive]);

  useEffect(() => {
    loadEmployees();
  }, [loadEmployees]);

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
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-primary">Equipo y tarifas</h1>
          <p className="text-sm text-base-content/70">
            Registra trabajadores, correos y tarifas para calcular automáticamente los totales mensuales.
          </p>
        </div>
        <Checkbox
          checked={includeInactive}
          onChange={(event: ChangeEvent<HTMLInputElement>) => setIncludeInactive(event.target.checked)}
          label="Ver inactivos"
        />
      </div>

      {error && <Alert variant="error">{error}</Alert>}

      {canEdit && (
        <div className="rounded-2xl border border-base-300 bg-base-100 p-6 shadow-sm">
          <EmployeeForm employee={editingEmployee} onSave={loadEmployees} onCancel={() => setEditingEmployee(null)} />
        </div>
      )}

      <div className="rounded-2xl border border-base-300 bg-base-100 p-6 shadow-sm">
        <EmployeeTable
          employees={employees}
          loading={loading}
          onEdit={setEditingEmployee}
          onDeactivate={handleDeactivate}
          onActivate={handleActivate}
        />
      </div>
    </section>
  );
}
