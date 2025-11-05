import { useCallback, useEffect, useState } from "react";
import type { ChangeEvent } from "react";
import { useAuth } from "../context/AuthContext";
import { fetchEmployees, deactivateEmployee, updateEmployee } from "../features/employees/api";
import type { Employee } from "../features/employees/types";
import EmployeeForm from "../features/employees/components/EmployeeForm";
import EmployeeTable from "../features/employees/components/EmployeeTable";
import Alert from "../components/Alert";
import Input from "../components/Input";
import { Card, PageHeader, Stack } from "../components/Layout";

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
    <Stack spacing="lg">
      <PageHeader
        title="Equipo y tarifas"
        description="Registra trabajadores, correos y tarifas para calcular automáticamente los totales mensuales."
        actions={
          <Input
            type="checkbox"
            checked={includeInactive}
            onChange={(event: ChangeEvent<HTMLInputElement>) => setIncludeInactive(event.target.checked)}
            label="Ver inactivos"
            className="w-fit"
          />
        }
      />

      {error && <Alert variant="error">{error}</Alert>}

      {canEdit && (
        <Card padding="default">
          <EmployeeForm employee={editingEmployee} onSave={loadEmployees} onCancel={() => setEditingEmployee(null)} />
        </Card>
      )}

      <Card padding="default">
        <EmployeeTable
          employees={employees}
          loading={loading}
          onEdit={setEditingEmployee}
          onDeactivate={handleDeactivate}
          onActivate={handleActivate}
        />
      </Card>
    </Stack>
  );
}
