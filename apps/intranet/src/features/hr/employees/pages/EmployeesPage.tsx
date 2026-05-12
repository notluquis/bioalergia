import { Alert, Button, Description, Switch } from "@heroui/react";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import type { PaginationState } from "@tanstack/react-table";
import { ChevronUp, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { DataTable } from "@/components/data-table/DataTable";
import { useAuth } from "@/context/AuthContext";
import { updateEmployee } from "@/features/hr/employees/api";
import { columns } from "@/features/hr/employees/components/columns";
import { EmployeeForm } from "@/features/hr/employees/components/EmployeeForm";
import { employeeKeys } from "@/features/hr/employees/queries";
import type { Employee } from "@/features/hr/employees/types";
import { PAGE_CONTAINER } from "@/lib/styles";
// ... existing imports
export function EmployeesPage() {
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

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: "ACTIVE" | "INACTIVE" }) =>
      updateEmployee(id, { status }),
  });

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
      { id, status: "INACTIVE" },
      {
        onSuccess: () => {
          void queryClient.invalidateQueries({ queryKey: employeeKeys.all });
        },
      }
    );
  }

  function handleActivate(id: number) {
    if (!canEdit) {
      return;
    }
    updateStatusMutation.mutate(
      { id, status: "ACTIVE" },
      {
        onSuccess: () => {
          void queryClient.invalidateQueries({ queryKey: employeeKeys.all });
        },
      }
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
        <div className="flex flex-wrap items-center gap-3">
          <Switch
            isSelected={includeInactive}
            onChange={(value) => {
              setIncludeInactive(value);
            }}
          >
            <Switch.Control>
              <Switch.Thumb />
            </Switch.Control>
            <Switch.Content>
              Ver inactivos
              <Description className="text-default-500 text-xs">
                Incluye empleados con estado inactivo.
              </Description>
            </Switch.Content>
          </Switch>
          {canEdit && (
            <Button
              className="w-full sm:w-auto"
              onPress={() => {
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

      {error && (
        <Alert status="danger">
          <Alert.Content>
            <Alert.Description>{error}</Alert.Description>
          </Alert.Content>
        </Alert>
      )}

      {canEdit && showForm && (
        <div className="rounded-2xl border border-default-200 bg-background p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold text-lg text-primary">
              {editingEmployee ? "Editar empleado" : "Agregar nuevo empleado"}
            </h2>
            <Button onPress={handleCancel} size="sm" variant="outline">
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
          scrollMaxHeight="min(68dvh, 760px)"
        />
      </div>
    </section>
  );
}
