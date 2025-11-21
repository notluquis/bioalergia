/**
 * Employee multi-select component for audit calendar
 * Limits selection to 5 employees with visual feedback
 */

import { useMemo, useState } from "react";
import type { Employee } from "../../employees/types";
import Checkbox from "../../../components/ui/Checkbox";

interface EmployeeAuditSelectorProps {
  employees: Employee[];
  selectedIds: number[];
  onSelectionChange: (ids: number[]) => void;
  loading?: boolean;
}

const MAX_EMPLOYEES = 5;

export default function EmployeeAuditSelector({
  employees,
  selectedIds,
  onSelectionChange,
  loading = false,
}: EmployeeAuditSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);

  const activeEmployees = useMemo(() => employees.filter((emp) => emp.status === "ACTIVE"), [employees]);

  const selectedNames = useMemo(
    () => selectedIds.map((id) => activeEmployees.find((e) => e.id === id)?.full_name).filter(Boolean),
    [selectedIds, activeEmployees]
  );

  const isMaxed = selectedIds.length >= MAX_EMPLOYEES;

  const handleToggle = (employeeId: number) => {
    if (selectedIds.includes(employeeId)) {
      onSelectionChange(selectedIds.filter((id) => id !== employeeId));
    } else if (!isMaxed) {
      onSelectionChange([...selectedIds, employeeId]);
    }
  };

  const displayText =
    selectedIds.length === 0
      ? "Seleccionar empleados..."
      : selectedIds.length <= 2
        ? selectedNames.join(", ")
        : `${selectedNames.slice(0, 2).join(", ")} +${selectedIds.length - 2}`;

  return (
    <div className="relative flex flex-col gap-2">
      <label className="text-xs font-semibold uppercase tracking-wide text-base-content/80">
        Empleados a auditar{" "}
        <span className="text-primary">
          ({selectedIds.length}/{MAX_EMPLOYEES})
        </span>
      </label>

      {/* Main button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        disabled={loading}
        className="input input-bordered flex h-12 w-full cursor-pointer select-none items-center justify-between gap-3 text-sm text-base-content disabled:opacity-50"
      >
        <span className="truncate font-medium">{displayText}</span>
        <svg
          className={`h-4 w-4 shrink-0 text-base-content/50 transition-transform ${isOpen ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
        </svg>
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="surface-recessed absolute top-full left-0 right-0 z-50 mt-2 shadow-lg">
          <div className="max-h-80 overflow-y-auto p-3 space-y-2">
            {activeEmployees.length === 0 ? (
              <p className="text-xs text-base-content/50 p-2">Sin empleados disponibles</p>
            ) : (
              activeEmployees.map((emp) => {
                const isSelected = selectedIds.includes(emp.id);
                const isDisabled = isMaxed && !isSelected;

                return (
                  <Checkbox
                    key={emp.id}
                    checked={isSelected}
                    onChange={() => handleToggle(emp.id)}
                    disabled={isDisabled}
                    label={emp.full_name}
                    className={`p-2 rounded text-sm transition-colors ${
                      isDisabled ? "opacity-50 cursor-not-allowed" : "hover:bg-base-100/60"
                    }`}
                  />
                );
              })
            )}
          </div>

          {isMaxed && (
            <div className="border-t border-base-300 bg-warning/10 px-3 py-2">
              <p className="text-xs text-warning">
                Máximo {MAX_EMPLOYEES} empleados pueden ser auditados simultáneamente
              </p>
            </div>
          )}
        </div>
      )}

      {/* Selected badges */}
      {selectedIds.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selectedIds.map((id) => {
            const emp = activeEmployees.find((e) => e.id === id);
            if (!emp) return null;

            return (
              <div key={id} className="badge badge-primary gap-2 text-xs">
                {emp.full_name}
                <button
                  type="button"
                  onClick={() => handleToggle(id)}
                  className="text-xs hover:text-error transition-colors"
                  aria-label={`Remove ${emp.full_name}`}
                >
                  ✕
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
