import { useUpdateEmployee } from "@finanzas/db/hooks";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import type { PaginationState } from "@tanstack/react-table";
import { ChevronUp, Plus } from "lucide-react";
import type { ChangeEvent } from "react";
import { useState } from "react";
import { DataTable } from "@/components/data-table/DataTable";
import Alert from "@/components/ui/Alert";
import Button from "@/components/ui/Button";
import Checkbox from "@/components/ui/Checkbox";
import { useAuth } from "@/context/AuthContext";
import { columns } from "@/features/hr/employees/components/columns";
import EmployeeForm from "@/features/hr/employees/components/EmployeeForm";
import { employeeKeys } from "@/features/hr/employees/queries";
import type { Employee } from "@/features/hr/employees/types";
import { PAGE_CONTAINER, TITLE_LG } from "@/lib/styles";
// ... existing imports

export default function EmployeesPage() {
  const { can } = useAuth();
  const canEdit = can("update", "Employee");
  const queryClient = useQueryClient();

  const [includeInactive, setIncludeInactive] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [showForm, setShowForm] = useState(false);

  // Pagination State
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  });

  // Query for employees
  const { data: employees } = useSuspenseQuery(employeeKeys.list({ includeInactive }));

  const loading = false; // Suspense handles loading

  // Client-side pagination logic
  const pageCount = Math.ceil(employees.length / pagination.pageSize);
  const paginatedEmployees = employees.slice(
    pagination.pageIndex * pagination.pageSize,
    (pagination.pageIndex + 1) * pagination.pageSize,
  );

  // ... rest of mutation logic ...
  const updateStatusMutation = useUpdateEmployee();
  const error = (() => {
    if (updateStatusMutation.error instanceof Error) return updateStatusMutation.error.message;
    return null;
  })();
  const isMutating = updateStatusMutation.isPending;

  function handleDeactivate(id: number) {
    if (!canEdit) return;
    updateStatusMutation.mutate(
      { data: { status: "INACTIVE" }, where: { id } },
      {
        onSuccess: () => {
          void queryClient.invalidateQueries({ queryKey: employeeKeys.all });
        },
      },
    );
  }

  function handleActivate(id: number) {
    if (!canEdit) return;
    updateStatusMutation.mutate(
      { data: { status: "ACTIVE" }, where: { id } },
      {
        onSuccess: () => {
          void queryClient.invalidateQueries({ queryKey: employeeKeys.all });
        },
      },
    );
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
    void queryClient.invalidateQueries({ queryKey: employeeKeys.all });
    handleCancel();
  }

  return (
    <section className={PAGE_CONTAINER}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <h1 className={TITLE_LG}>Equipo y tarifas</h1>
        <div className="flex items-center gap-3">
          <Checkbox
            checked={includeInactive}
            label="Ver inactivos"
            onChange={(event: ChangeEvent<HTMLInputElement>) => {
              setIncludeInactive(event.target.checked);
            }}
          />
          {canEdit && (
            <Button
              onClick={() => {
                if (showForm) {
                  handleCancel();
                } else {
                  setShowForm(true);
                }
              }}
              size="md"
              variant={showForm ? "outline" : "primary"}
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
        <div className="border-default-200 bg-background rounded-2xl border p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-primary text-lg font-semibold">
              {editingEmployee ? "Editar empleado" : "Agregar nuevo empleado"}
            </h2>
            <Button onClick={handleCancel} size="sm" variant="ghost">
              <ChevronUp className="h-4 w-4" />
              Cerrar
            </Button>
          </div>
          <EmployeeForm
            employee={editingEmployee}
            onCancel={handleCancel}
            onSave={handleSaveSuccess}
          />
        </div>
      )}

      <div className="surface-elevated rounded-2xl p-4">
        <DataTable
          columns={columns}
          data={paginatedEmployees}
          containerVariant="plain"
          enableExport={false}
          enableGlobalFilter={false}
          enableVirtualization
          filters={[
            {
              columnId: "status",
              options: [
                { label: "Activo", value: "ACTIVE" },
                { label: "Inactivo", value: "INACTIVE" },
              ],
              title: "Estado",
            },
          ]}
          isLoading={loading || isMutating}
          meta={{
            canEdit,
            onActivate: handleActivate,
            onDeactivate: handleDeactivate,
            onEdit: handleEdit,
          }}
          onPaginationChange={setPagination}
          pageCount={pageCount}
          pagination={pagination}
        />
      </div>
    </section>
  );
}
