import { useFindManyEmployee, useUpdateEmployee } from "@finanzas/db/hooks";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronUp, Plus } from "lucide-react";
import type { ChangeEvent } from "react";
import { useState } from "react";

import Alert from "@/components/ui/Alert";
import Button from "@/components/ui/Button";
import Checkbox from "@/components/ui/Checkbox";
import { useAuth } from "@/context/AuthContext";
import EmployeeForm from "@/features/hr/employees/components/EmployeeForm";
import EmployeeTable from "@/features/hr/employees/components/EmployeeTable";
import type { Employee } from "@/features/hr/employees/types";
import { getPersonFullName } from "@/lib/person";
import { PAGE_CONTAINER, TITLE_LG } from "@/lib/styles";

export default function EmployeesPage() {
  const { can } = useAuth();
  const canEdit = can("update", "Employee");
  const queryClient = useQueryClient();

  const [includeInactive, setIncludeInactive] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [showForm, setShowForm] = useState(false);

  // Query for employees
  const {
    data: rawEmployees = [],
    isLoading: loading,
    error: queryError,
    // refetch: loadEmployees, // ZenStack hooks handle invalidation automatically via queryClient
  } = useFindManyEmployee({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    where: includeInactive ? undefined : ({ status: "ACTIVE" } as any),
    include: { person: true },
    orderBy: { createdAt: "desc" },
  });

  // Calculate full_name for display compatibility
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const employees = (rawEmployees as any[]).map((e) => ({
    ...e,
    full_name: getPersonFullName((e.person as any) || {}) || "Sin nombre",
  }));

  // Mutation for deactivating (Soft Delete)
  // We use useUpdate instead of manual fetch.
  // Assuming "deactivate" means setting status to INACTIVE.
  // Mutation for deactivating (Soft Delete)
  // We use useUpdate instead of manual fetch.
  // Assuming "deactivate" means setting status to INACTIVE.
  const updateStatusMutation = useUpdateEmployee();

  // Clean up legacy mutations if they exist, but for now we map new logic:

  const error =
    queryError instanceof Error
      ? queryError.message
      : updateStatusMutation.error instanceof Error
        ? updateStatusMutation.error.message
        : null;

  const isMutating = updateStatusMutation.isPending;

  function handleDeactivate(id: number) {
    if (!canEdit) return;
    updateStatusMutation.mutate({
      where: { id },
      data: { status: "INACTIVE" },
    });
  }

  function handleActivate(id: number) {
    if (!canEdit) return;
    updateStatusMutation.mutate({
      where: { id },
      data: { status: "ACTIVE" },
    });
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
    // Invalidate ZenStack's Employee query cache (uses "Employee" not "employee")
    queryClient.invalidateQueries({ queryKey: ["Employee"] });
    handleCancel();
  }

  return (
    <section className={PAGE_CONTAINER}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <h1 className={TITLE_LG}>Equipo y tarifas</h1>
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
          loading={loading || isMutating}
          onEdit={handleEdit}
          onDeactivate={handleDeactivate}
          onActivate={handleActivate}
        />
      </div>
    </section>
  );
}
