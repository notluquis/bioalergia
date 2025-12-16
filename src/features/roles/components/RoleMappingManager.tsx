import { useState, useEffect } from "react";
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
  const [mappings, setMappings] = useState<ExtendedRoleMapping[]>([]);
  const [jobTitles, setJobTitles] = useState<string[]>([]);
  const [availableRoles, setAvailableRoles] = useState<AvailableRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const fetchInitialData = async () => {
      setLoading(true);
      setError(null);
      try {
        const [employees, dbMappings, rolesRes] = await Promise.all([
          fetchEmployees(true),
          getRoleMappings(),
          apiClient.get<{ roles: AvailableRole[] }>("/api/roles"),
        ]);

        const roles = rolesRes.roles;
        setAvailableRoles(roles);

        const dbMappingsMap = new Map(dbMappings.map((m: RoleMapping) => [m.employee_role, m]));
        const uniqueRoles = [...new Set(employees.map((e: Employee) => e.position))].sort();
        setJobTitles(uniqueRoles);

        const allRoles = uniqueRoles.map((resultRole: string) => {
          const existing = dbMappingsMap.get(resultRole);
          if (existing) {
            return { ...existing, isNew: false, isModified: false };
          }
          // Default to first available role or empty if none (though VIEWER is likely)
          const defaultRole = roles.find((r: AvailableRole) => r.name === "VIEWER")?.name || roles[0]?.name || "";
          return { employee_role: resultRole, app_role: defaultRole, isNew: true, isModified: false };
        });

        setMappings(allRoles);
      } catch (err) {
        setError(err instanceof Error ? err.message : "No se pudo cargar la configuración de roles");
      } finally {
        setLoading(false);
      }
    };

    fetchInitialData();
  }, []);

  const handleRoleChange = (employeeRole: string, newAppRole: string) => {
    setMappings(
      mappings.map((m) => (m.employee_role === employeeRole ? { ...m, app_role: newAppRole, isModified: !m.isNew } : m))
    );
  };

  const handleSave = async () => {
    const changedMappings = mappings.filter((m) => m.isNew || m.isModified);
    if (changedMappings.length === 0) return;

    setIsSaving(true);
    setError(null);
    try {
      await Promise.all(
        changedMappings.map((m) => saveRoleMapping({ employee_role: m.employee_role, app_role: m.app_role }))
      );

      const freshMappings = await getRoleMappings();
      const dbMappingsMap = new Map(freshMappings.map((m: RoleMapping) => [m.employee_role, m]));
      const allRoles = jobTitles.map((role: string) => {
        const existing = dbMappingsMap.get(role);
        if (existing) {
          return { ...existing, isNew: false, isModified: false };
        }
        // Use cached available roles for default
        const defaultRole = availableRoles.find((r) => r.name === "VIEWER")?.name || availableRoles[0]?.name || "";
        return { employee_role: role, app_role: defaultRole, isNew: true, isModified: false };
      });
      setMappings(allRoles);
    } catch {
      setError("No se pudo guardar el cambio. Intente de nuevo.");
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) {
    return <div className="text-primary bg-base-100 p-6 text-sm">Cargando configuración de roles...</div>;
  }

  return (
    <section className="bg-base-100 space-y-5 p-6">
      <div className="space-y-1">
        <h2 className="text-primary text-lg font-semibold drop-shadow-sm">Gobernanza de Roles</h2>
        <p className="text-base-content/90 text-sm">
          Asigna un rol de la aplicación a cada cargo de empleado para controlar los permisos de acceso.
        </p>
      </div>

      {error && <p className="text-error text-sm">{error}</p>}

      <div className="divide-base-300 border-base-300 bg-base-200 divide-y rounded-2xl border">
        {mappings.map((mapping) => (
          <div
            key={mapping.employee_role}
            className="grid gap-3 p-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,220px)] sm:items-center"
          >
            <label className="text-base-content font-medium">{mapping.employee_role}</label>
            <select
              value={mapping.app_role}
              onChange={(e) => handleRoleChange(mapping.employee_role, e.target.value)}
              className="select select-bordered text-sm"
            >
              {availableRoles.map((role) => (
                <option key={role.id} value={role.name}>
                  {role.name}
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={isSaving}>
          {isSaving ? "Guardando..." : "Guardar Cambios"}
        </Button>
      </div>
    </section>
  );
}
