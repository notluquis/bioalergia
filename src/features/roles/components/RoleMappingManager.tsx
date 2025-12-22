import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchEmployees, type Employee } from "@/features/hr/employees/api";
import { getRoleMappings, saveRoleMapping } from "../api";
import { apiClient } from "@/lib/apiClient";
import type { RoleMapping } from "../api";
import Button from "@/components/ui/Button";

type AvailableRole = {
  id: number;
  name: string;
  description: string | null;
};

type ExtendedRoleMapping = RoleMapping & { isNew?: boolean; isModified?: boolean };

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
      const [employees, dbMappings, rolesRes] = await Promise.all([
        fetchEmployees(true),
        getRoleMappings(),
        apiClient.get<{ roles: AvailableRole[] }>("/api/roles"),
      ]);
      return { employees, dbMappings, roles: rolesRes.roles };
    },
    refetchOnWindowFocus: false,
  });

  const saveMutation = useMutation({
    mutationFn: async (changedMappings: ExtendedRoleMapping[]) => {
      await Promise.all(
        changedMappings.map((m) => saveRoleMapping({ employee_role: m.employee_role, app_role: m.app_role }))
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
      const uniqueRoles = [...new Set(employees.map((e: Employee) => e.position))].sort();

      const allRoles = uniqueRoles.map((resultRole: string) => {
        const existing = dbMappingsMap.get(resultRole);
        if (existing) {
          return { ...existing, isNew: false, isModified: false };
        }
        const defaultRole = roles.find((r: AvailableRole) => r.name === "VIEWER")?.name || roles[0]?.name || "";
        return { employee_role: resultRole, app_role: defaultRole, isNew: true, isModified: false };
      });

      setMappings(allRoles);
    }
  }, [data]);

  const handleRoleChange = (employeeRole: string, newAppRole: string) => {
    setMappings(
      mappings.map((m) => (m.employee_role === employeeRole ? { ...m, app_role: newAppRole, isModified: !m.isNew } : m))
    );
  };

  const handleSave = async () => {
    const changedMappings = mappings.filter((m) => m.isNew || m.isModified);
    if (changedMappings.length === 0) return;
    saveMutation.mutate(changedMappings);
  };

  const error =
    queryError instanceof Error
      ? queryError.message
      : queryError
        ? String(queryError)
        : saveMutation.error instanceof Error
          ? saveMutation.error.message
          : null;
  const isSaving = saveMutation.isPending;

  if (loading) {
    return <div className="text-primary bg-base-100 p-6 text-sm">Cargando configuración de roles...</div>;
  }

  /* Rest of render logic... */
  // Need to ensure I don't break return statement below.
  // The snippet I'm replacing includes `if (loading)` and up to line 100.
  // I need to provide the render part or keep it.
  // The replace call target ends at 143 (end of file?).
  // Wait, the file has 143 lines? Previous view_file showed lines 1-100.
  // I should check total lines.

  return (
    <div className="bg-base-100 space-y-4 rounded-xl p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <h3 className="text-base-content text-lg font-bold">Mapeo de Roles (Cargo → Rol App)</h3>
        {error && <span className="text-error text-sm">{error}</span>}
      </div>

      <p className="text-base-content/70 text-sm">
        Asigna qué rol de aplicación tendrán los empleados automáticamente según su cargo en la ficha.
      </p>

      <div className="overflow-x-auto">
        <table className="table w-full">
          <thead>
            <tr>
              <th>Cargo en Ficha</th>
              <th>Rol en Aplicación</th>
            </tr>
          </thead>
          <tbody>
            {mappings.map((mapping) => (
              <tr key={mapping.employee_role}>
                <td className="font-medium">{mapping.employee_role}</td>
                <td>
                  <select
                    className="select select-bordered select-sm w-full max-w-xs"
                    value={mapping.app_role}
                    onChange={(e) => handleRoleChange(mapping.employee_role, e.target.value)}
                  >
                    {availableRoles.map((role) => (
                      <option key={role.id} value={role.name} title={role.description || ""}>
                        {role.name}
                      </option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
            {mappings.length === 0 && (
              <tr>
                <td colSpan={2} className="text-base-content/50 py-4 text-center text-sm italic">
                  No se encontraron cargos de empleados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

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
