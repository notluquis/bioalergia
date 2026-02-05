import { schema as schemaLite } from "@finanzas/db/schema-lite";
import { Switch } from "@heroui/react";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import type { PaginationState } from "@tanstack/react-table";
import { useClientQueries } from "@zenstackhq/tanstack-query/react";
import { ChevronUp, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { DataTable } from "@/components/data-table/DataTable";
import Alert from "@/components/ui/Alert";
import Button from "@/components/ui/Button";
import { useAuth } from "@/context/AuthContext";
import { columns } from "@/features/hr/employees/components/columns";
import EmployeeForm from "@/features/hr/employees/components/EmployeeForm";
import { employeeKeys } from "@/features/hr/employees/queries";
import type { Employee } from "@/features/hr/employees/types";
import { PAGE_CONTAINER, TITLE_LG } from "@/lib/styles";
// ... existing imports

export default function EmployeesPage() {
  const client = useClientQueries(schemaLite);

  const { can } = useAuth();
  const canEdit = can("update", "Employee");
  const queryClient = useQueryClient();

  const [includeInactive, setIncludeInactive] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [showForm, setShowForm] = useState(false);

  // Pagination State
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 20,
  });

  // Query for employees
  const { data: employees } = useSuspenseQuery(employeeKeys.list({ includeInactive }));

  useEffect(() => {
    const nextPageIndex = includeInactive ? 0 : 0;
    setPagination((prev) => ({ ...prev, pageIndex: nextPageIndex }));
  }, [includeInactive]);

  // ... rest of mutation logic ...
  const updateStatusMutation = client.employee.useUpdate();
  const error = (() => {
    if (updateStatusMutation.error instanceof Error) {
      return updateStatusMutation.error.message;
    }
    return null;
  })();
  const isMutating = updateStatusMutation.isPending;

  function handleDeactivate(id: number) {
    if (!canEdit) {
      return;
    }
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
    if (!canEdit) {
      return;
    }
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
        <div className="flex flex-wrap items-center gap-3">
          <Switch
            isSelected={includeInactive}
            onChange={(value) => {
              setIncludeInactive(value);
            }}
          >
            Ver inactivos
          </Switch>
          {canEdit && (
            <Button
              className="w-full sm:w-auto"
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
        <div className="rounded-2xl border border-default-200 bg-background p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold text-lg text-primary">
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
          data={employees}
          containerVariant="plain"
          enableExport={false}
          enableGlobalFilter={false}
          enableVirtualization={false}
          isLoading={isMutating}
          meta={{
            canEdit,
            onActivate: handleActivate,
            onDeactivate: handleDeactivate,
            onEdit: handleEdit,
          }}
          onPaginationChange={setPagination}
          pageSizeOptions={[10, 20, 50]}
          pagination={pagination}
        />
      </div>
    </section>
  );
}
