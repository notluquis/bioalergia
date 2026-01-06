/**
 * Employee multi-select component for audit calendar
 * Limits selection to 5 employees with visual feedback
 */

import { useState } from "react";

import Checkbox from "@/components/ui/Checkbox";
import type { Employee } from "@/features/hr/employees/types";

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

  const activeEmployees = employees.filter((emp) => emp.status === "ACTIVE");
  const selectedNames = selectedIds.map((id) => activeEmployees.find((e) => e.id === id)?.full_name).filter(Boolean);

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
      <label className="text-base-content/80 text-xs font-semibold tracking-wide uppercase">
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
        className="input input-bordered text-base-content flex h-12 w-full cursor-pointer items-center justify-between gap-3 text-sm select-none disabled:opacity-50"
      >
        <span className="truncate font-medium">{displayText}</span>
        <svg
          className={`text-base-content/50 h-4 w-4 shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
        </svg>
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="surface-recessed absolute top-full right-0 left-0 z-50 mt-2 shadow-lg">
          <div className="max-h-80 space-y-2 overflow-y-auto p-3">
            {activeEmployees.length === 0 ? (
              <p className="text-base-content/50 p-2 text-xs">Sin empleados disponibles</p>
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
                    className={`rounded p-2 text-sm transition-colors ${
                      isDisabled ? "cursor-not-allowed opacity-50" : "hover:bg-base-100/60"
                    }`}
                  />
                );
              })
            )}
          </div>

          {isMaxed && (
            <div className="border-base-300 bg-warning/10 border-t px-3 py-2">
              <p className="text-warning text-xs">
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
                  className="hover:text-error text-xs transition-colors"
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
