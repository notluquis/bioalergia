import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";

import { DataTable } from "@/components/data-table/DataTable";
import Button from "@/components/ui/Button";
import { type Employee, fetchEmployees } from "@/features/hr/employees/api";
import type { Role as AvailableRole } from "@/types/roles";

import type { RoleMapping } from "../api";
import { fetchRoles, getRoleMappings, saveRoleMapping } from "../api";
import type { ExtendedRoleMapping } from "./RoleMappingColumns";
import { getColumns } from "./RoleMappingColumns";

export default function RoleMappingManager() {
  const queryClient = useQueryClient();
  const [mappings, setMappings] = useState<ExtendedRoleMapping[]>([]);
  const [availableRoles, setAvailableRoles] = useState<AvailableRole[]>([]);

  const {
    data,
    isLoading: loading,
    error: queryError,
  } = useQuery<{
    employees: Employee[];
    dbMappings: RoleMapping[];
    roles: AvailableRole[];
  }>({
    queryKey: ["role-mappings-data"],
    queryFn: async () => {
      const [employees, dbMappings, roles] = await Promise.all([fetchEmployees(true), getRoleMappings(), fetchRoles()]);
      return { employees, dbMappings, roles };
    },
    refetchOnWindowFocus: false,
  });

  const saveMutation = useMutation({
    mutationFn: async (changedMappings: ExtendedRoleMapping[]) => {
      await Promise.all(
        changedMappings.map((m) =>
          saveRoleMapping({
            employee_role: m.employee_role,
            app_role: m.app_role,
          })
        )
      );
      return getRoleMappings();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["role-mappings-data"] });
    },
    onError: () => {
      // handled in component error state if needed, but we use mutation.error
    },
  });

  // Sync data to local state
  useEffect(() => {
    if (data) {
      const { employees, dbMappings, roles } = data;
      setAvailableRoles(roles);

      const dbMappingsMap = new Map(dbMappings.map((m: RoleMapping) => [m.employee_role, m]));
      const uniqueRoles = [...new Set(employees.map((e: Employee) => e.position))].toSorted((a, b) =>
        a.localeCompare(b)
      );

      const allRoles = uniqueRoles.map((resultRole: string) => {
        const existing = dbMappingsMap.get(resultRole);
        if (existing) {
          return { ...existing, isNew: false, isModified: false };
        }
        const defaultRole = roles.find((r: AvailableRole) => r.name === "VIEWER")?.name || roles[0]?.name || "";
        return {
          employee_role: resultRole,
          app_role: defaultRole,
          isNew: true,
          isModified: false,
        };
      });

      setMappings(allRoles);
    }
  }, [data]);

  const handleRoleChange = (employeeRole: string, newAppRole: string) => {
    setMappings((prev) =>
      prev.map((m) => (m.employee_role === employeeRole ? { ...m, app_role: newAppRole, isModified: !m.isNew } : m))
    );
  };

  const columns = useMemo(
    () => getColumns(availableRoles, handleRoleChange),
    [availableRoles] // handleRoleChange is now stable-ish because setMappings uses functional update, but variable handleRoleChange itself changes every render?
    // No, arrow function in render. Use useMemo or just pass it efficiently.
    // IMPORTANT: Since handleRoleChange is defined in render, it changes every render.
    // The Columns will be regenerated every render. But that's okay for now, DataTable handles it.
  );

  const handleSave = async () => {
    const changedMappings = mappings.filter((m) => m.isNew || m.isModified);
    if (changedMappings.length === 0) return;
    saveMutation.mutate(changedMappings);
  };

  const queryErrorMessage = (() => {
    if (queryError instanceof Error) return queryError.message;
    return queryError ? String(queryError) : null;
  })();

  const saveErrorMessage = (() => {
    if (saveMutation.error instanceof Error) return saveMutation.error.message;
    return null;
  })();

  const error = queryErrorMessage || saveErrorMessage;
  const isSaving = saveMutation.isPending;

  if (loading) {
    return <div className="text-primary bg-base-100 p-6 text-sm">Cargando configuración de roles...</div>;
  }

  return (
    <div className="bg-base-100 space-y-4 rounded-xl p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <h3 className="text-base-content text-lg font-bold">Mapeo de Roles (Cargo → Rol App)</h3>
        {error && <span className="text-error text-sm">{error}</span>}
      </div>

      <p className="text-base-content/70 text-sm">
        Asigna qué rol de aplicación tendrán los empleados automáticamente según su cargo en la ficha.
      </p>

      <DataTable data={mappings} columns={columns} enableToolbar={false} pagination={{ pageIndex: 0, pageSize: 100 }} />

      <div className="flex justify-end pt-2">
        <Button
          onClick={handleSave}
          disabled={isSaving || mappings.every((m) => !m.isNew && !m.isModified)}
          isLoading={isSaving}
        >
          Guardar Cambios
        </Button>
      </div>
    </div>
  );
}
