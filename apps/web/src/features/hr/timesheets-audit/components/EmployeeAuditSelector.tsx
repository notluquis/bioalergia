/**
 * Employee multi-select component for audit calendar
 * Limits selection to 5 employees with visual feedback
 */

import { useState } from "react";

import type { Employee } from "@/features/hr/employees/types";

import Checkbox from "@/components/ui/Checkbox";

interface EmployeeAuditSelectorProps {
  employees: Employee[];
  loading?: boolean;
  onSelectionChange: (ids: number[]) => void;
  selectedIds: number[];
}

const MAX_EMPLOYEES = 5;

export default function EmployeeAuditSelector({
  employees,
  loading = false,
  onSelectionChange,
  selectedIds,
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

  const displayText = (() => {
    if (selectedIds.length === 0) return "Seleccionar empleados...";
    if (selectedIds.length <= 2) return selectedNames.join(", ");
    return `${selectedNames.slice(0, 2).join(", ")} +${selectedIds.length - 2}`;
  })();

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
        className="input input-bordered text-base-content flex h-12 w-full cursor-pointer items-center justify-between gap-3 text-sm select-none disabled:opacity-50"
        disabled={loading}
        onClick={() => {
          setIsOpen(!isOpen);
        }}
        type="button"
      >
        <span className="truncate font-medium">{displayText}</span>
        <svg
          className={`text-base-content/50 h-4 w-4 shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path d="M19 14l-7 7m0 0l-7-7m7 7V3" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} />
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
                    checked={isSelected}
                    className={`rounded p-2 text-sm transition-colors ${
                      isDisabled ? "cursor-not-allowed opacity-50" : "hover:bg-base-100/60"
                    }`}
                    disabled={isDisabled}
                    key={emp.id}
                    label={emp.full_name}
                    onChange={() => {
                      handleToggle(emp.id);
                    }}
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
              <div className="badge badge-primary gap-2 text-xs" key={id}>
                {emp.full_name}
                <button
                  aria-label={`Remove ${emp.full_name}`}
                  className="hover:text-error text-xs transition-colors"
                  onClick={() => {
                    handleToggle(id);
                  }}
                  type="button"
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
