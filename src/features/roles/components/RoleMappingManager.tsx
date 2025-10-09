import { useState, useEffect } from "react";
import { fetchEmployees, type Employee } from "../../employees/api";
import { getRoleMappings, saveRoleMapping } from "../api";
import type { RoleMapping, UserRole } from "../../../../server/db";
import Button from "../../../components/Button";

type ExtendedRoleMapping = RoleMapping & { isNew?: boolean; isModified?: boolean };

const APP_ROLES: UserRole[] = ["VIEWER", "ANALYST", "ADMIN", "GOD"];

export default function RoleMappingManager() {
  const [mappings, setMappings] = useState<ExtendedRoleMapping[]>([]);
  const [jobTitles, setJobTitles] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const fetchInitialData = async () => {
      setLoading(true);
      setError(null);
      try {
        const [employees, dbMappings] = await Promise.all([fetchEmployees(true), getRoleMappings()]);

        const dbMappingsMap = new Map(dbMappings.map((m: RoleMapping) => [m.employee_role, m]));
        const uniqueRoles = [...new Set(employees.map((e: Employee) => e.role))].sort();
        setJobTitles(uniqueRoles);

        const allRoles = uniqueRoles.map((role: string) => {
          const existing = dbMappingsMap.get(role);
          if (existing) {
            return { ...existing, isNew: false, isModified: false };
          }
          return { employee_role: role, app_role: "VIEWER" as UserRole, isNew: true, isModified: false };
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

  const handleRoleChange = (employeeRole: string, newAppRole: UserRole) => {
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
        return { employee_role: role, app_role: "VIEWER" as UserRole, isNew: true, isModified: false };
      });
      setMappings(allRoles);
    } catch (err) {
      setError("No se pudo guardar el cambio. Intente de nuevo.");
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="glass-card glass-underlay-gradient p-6 text-sm text-[var(--brand-primary)]">
        Cargando configuración de roles...
      </div>
    );
  }

  return (
    <section className="glass-card glass-underlay-gradient space-y-5 p-6">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold text-[var(--brand-primary)] drop-shadow-sm">Gobernanza de Roles</h2>
        <p className="text-sm text-slate-600/90">
          Asigna un rol de la aplicación a cada cargo de empleado para controlar los permisos de acceso.
        </p>
      </div>

      {error && <p className="text-sm text-rose-600">{error}</p>}

      <div className="divide-y divide-white/45 rounded-2xl border border-white/55 bg-white/55">
        {mappings.map((mapping) => (
          <div
            key={mapping.employee_role}
            className="grid gap-3 p-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,220px)] sm:items-center"
          >
            <label className="font-medium text-slate-700">{mapping.employee_role}</label>
            <select
              value={mapping.app_role}
              onChange={(e) => handleRoleChange(mapping.employee_role, e.target.value as UserRole)}
              className="glass-input text-sm"
            >
              {APP_ROLES.map((role) => (
                <option key={role} value={role}>
                  {role}
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
