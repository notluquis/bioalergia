import { useCallback, useEffect, useState } from "react";
import type { ChangeEvent } from "react";
import { useAuth } from "@/context/AuthContext";
import { fetchEmployees, deactivateEmployee, updateEmployee } from "@/features/hr/employees/api";
import type { Employee } from "@/features/hr/employees/types";
import EmployeeForm from "@/features/hr/employees/components/EmployeeForm";
import EmployeeTable from "@/features/hr/employees/components/EmployeeTable";
import Alert from "@/components/ui/Alert";
import Checkbox from "@/components/ui/Checkbox";
import Button from "@/components/ui/Button";
import { ChevronUp, Plus } from "lucide-react";

export default function EmployeesPage() {
  const { hasRole } = useAuth();
  const canEdit = hasRole("GOD", "ADMIN");

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [includeInactive, setIncludeInactive] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [showForm, setShowForm] = useState(false);

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

  function handleEdit(employee: Employee) {
    setEditingEmployee(employee);
    setShowForm(true);
  }

  function handleCancel() {
    setEditingEmployee(null);
    setShowForm(false);
  }

  function handleSaveSuccess() {
    loadEmployees();
    handleCancel();
  }

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <h1 className="text-primary text-2xl font-bold">Equipo y tarifas</h1>
          <p className="text-base-content/70 text-sm">
            Registra trabajadores, correos y tarifas para calcular automáticamente los totales mensuales.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Checkbox
            checked={includeInactive}
            onChange={(event: ChangeEvent<HTMLInputElement>) => setIncludeInactive(event.target.checked)}
            label="Ver inactivos"
          />
          {canEdit && (
            <Button
              variant={showForm ? "outline" : "primary"}
              size="md"
              onClick={() => {
                if (showForm) {
                  handleCancel();
                } else {
                  setShowForm(true);
                }
              }}
            >
              {showForm ? (
                <>
                  <ChevronUp className="h-4 w-4" />
                  Ocultar formulario
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4" />
                  {editingEmployee ? "Editar empleado" : "Agregar empleado"}
                </>
              )}
            </Button>
          )}
        </div>
      </div>

      {error && <Alert variant="error">{error}</Alert>}

      {canEdit && showForm && (
        <div className="border-base-300 bg-base-100 rounded-2xl border p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-primary text-lg font-semibold">
              {editingEmployee ? "Editar empleado" : "Agregar nuevo empleado"}
            </h2>
            <Button variant="ghost" size="sm" onClick={handleCancel}>
              <ChevronUp className="h-4 w-4" />
              Cerrar
            </Button>
          </div>
          <EmployeeForm employee={editingEmployee} onSave={handleSaveSuccess} onCancel={handleCancel} />
        </div>
      )}

      <div className="border-base-300 bg-base-100 rounded-2xl border p-6 shadow-sm">
        <EmployeeTable
          employees={employees}
          loading={loading}
          onEdit={handleEdit}
          onDeactivate={handleDeactivate}
          onActivate={handleActivate}
        />
      </div>
    </section>
  );
}
