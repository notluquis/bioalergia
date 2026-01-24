import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { DataTable } from "@/components/data-table/DataTable";
import Button from "@/components/ui/Button";
import type { Employee } from "@/features/hr/employees/api";
import type { Role as AvailableRole } from "@/types/roles";

import type { RoleMapping } from "../api";
import { roleQueries, saveRoleMapping } from "../api";
import type { ExtendedRoleMapping } from "./RoleMappingColumns";
import { getColumns } from "./RoleMappingColumns";

export default function RoleMappingManager() {
  const queryClient = useQueryClient();
  const [mappings, setMappings] = useState<ExtendedRoleMapping[]>([]);
  const [availableRoles, setAvailableRoles] = useState<AvailableRole[]>([]);

  const { data } = useSuspenseQuery(roleQueries.mappings());

  const saveMutation = useMutation({
    mutationFn: async (changedMappings: ExtendedRoleMapping[]) => {
      await Promise.all(
        changedMappings.map((m) =>
          saveRoleMapping({
            app_role: m.app_role,
            employee_role: m.employee_role,
          }),
        ),
      );
      // Invalidate the mapping query
      return queryClient.invalidateQueries({ queryKey: roleQueries.mappings().queryKey });
    },
    onError: () => {
      // handled in component error state if needed, but we use mutation.error
    },
    onSuccess: () => {
      // Success means invalidation is triggerd
    },
  });

  // Sync data to local state
  useEffect(() => {
    // data is guaranteed by Suspense
    const { dbMappings, employees, roles } = data;
    setAvailableRoles(roles);

    const dbMappingsMap = new Map(dbMappings.map((m: RoleMapping) => [m.employee_role, m]));
    const uniqueRoles = [...new Set(employees.map((e: Employee) => e.position))].toSorted((a, b) =>
      a.localeCompare(b),
    );

    const allRoles = uniqueRoles.map((resultRole: string) => {
      const existing = dbMappingsMap.get(resultRole);
      if (existing) {
        // Explicitly construct object to satisfy TS
        return {
          app_role: existing.app_role,
          employee_role: existing.employee_role,
          isModified: false,
          isNew: false,
        };
      }
      const defaultRole =
        roles.find((r: AvailableRole) => r.name === "VIEWER")?.name || roles[0]?.name || "";
      return {
        app_role: defaultRole,
        employee_role: resultRole,
        isModified: false,
        isNew: true,
      };
    });

    setMappings(allRoles);
  }, [data]);

  const handleRoleChange = (employeeRole: string, newAppRole: string) => {
    setMappings((prev) =>
      prev.map((m) =>
        m.employee_role === employeeRole ? { ...m, app_role: newAppRole, isModified: !m.isNew } : m,
      ),
    );
  };

  const columns = useMemo(
    () => getColumns(availableRoles, handleRoleChange),
    // biome-ignore lint/correctness/useExhaustiveDependencies: legacy hook
    [availableRoles, handleRoleChange],
  );

  const handleSave = async () => {
    const changedMappings = mappings.filter((m) => m.isNew || m.isModified);
    if (changedMappings.length === 0) return;
    saveMutation.mutate(changedMappings);
  };

  const saveErrorMessage = (() => {
    if (saveMutation.error instanceof Error) return saveMutation.error.message;
    return null;
  })();

  const isSaving = saveMutation.isPending;

  return (
    <div className="bg-background space-y-4 rounded-xl p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <h3 className="text-foreground text-lg font-bold">Mapeo de Roles (Cargo → Rol App)</h3>
        {saveErrorMessage && <span className="text-danger text-sm">{saveErrorMessage}</span>}
      </div>

      <p className="text-default-600 text-sm">
        Asigna qué rol de aplicación tendrán los empleados automáticamente según su cargo en la
        ficha.
      </p>

      <DataTable
        columns={columns}
        data={mappings}
        enableToolbar={false}
        containerVariant="plain"
        pagination={{ pageIndex: 0, pageSize: 100 }}
      />

      <div className="flex justify-end pt-2">
        <Button
          disabled={isSaving || mappings.every((m) => !m.isNew && !m.isModified)}
          isLoading={isSaving}
          onClick={handleSave}
        >
          Guardar Cambios
        </Button>
      </div>
    </div>
  );
}
