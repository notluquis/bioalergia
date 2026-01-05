import dayjs from "dayjs";
import { useEffect, useState } from "react";

import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import { useAuth } from "@/context/AuthContext";
import type { Employee } from "@/features/hr/employees/types";
import { LOADING_SPINNER_SM } from "@/lib/styles";

import type { BulkRow } from "../types";
import { formatDateLabel, isRowDirty } from "../utils";
import TimesheetRow from "./TimesheetRow";

interface TimesheetDetailTableProps {
  bulkRows: BulkRow[];
  initialRows: BulkRow[];
  loadingDetail: boolean;
  selectedEmployee: Employee | null;
  onRowChange: (index: number, field: keyof Omit<BulkRow, "date" | "entryId">, value: string) => void;
  onSalidaBlur: (index: number) => void;
  onResetRow: (index: number) => void;
  onRemoveEntry: (row: BulkRow) => void;
  onBulkSave: () => void;
  saving: boolean;
  pendingCount: number;
  modifiedCount: number;
  monthLabel: string;
  employeeOptions: Employee[];
}

export default function TimesheetDetailTable({
  bulkRows,
  initialRows,
  loadingDetail,
  selectedEmployee,
  onRowChange,
  onSalidaBlur,
  onResetRow,
  onRemoveEntry,
  onBulkSave,
  saving,
  pendingCount,
  modifiedCount,
  monthLabel,
  employeeOptions,
}: TimesheetDetailTableProps) {
  const { can } = useAuth();
  const canEdit = can("update", "Timesheet");
  const [openOvertimeEditors, setOpenOvertimeEditors] = useState<Set<string>>(new Set());
  const [commentPreview, setCommentPreview] = useState<{ date: string; text: string } | null>(null);
  const [notWorkedDays, setNotWorkedDays] = useState<Set<string>>(new Set());

  // Toggle helper for per-row actions menu
  const toggleMenu = (id: string) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.toggle("hidden");
  };

  // Función para calcular horas trabajadas entre entrada y salida
  const calculateWorkedHours = (startTime: string, endTime: string) => {
    if (!startTime || !endTime || startTime === "00:00" || endTime === "00:00") return "00:00";

    const start = timeToMinutes(startTime);
    const end = timeToMinutes(endTime);

    if (start === null || end === null) return "00:00";

    let totalMinutes = end - start;

    // Si end < start, asumimos que cruza medianoche (ej: 22:00 a 06:00)
    if (totalMinutes < 0) {
      totalMinutes = 24 * 60 + totalMinutes;
    }

    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`;
  };

  // Función para convertir HH:MM a minutos
  const timeToMinutes = (time: string): number | null => {
    if (!/^[0-9]{1,2}:[0-9]{2}$/.test(time)) return null;
    const parts = time.split(":").map(Number);

    const [hours, minutes] = parts;

    if (hours === undefined || minutes === undefined) return null;
    if (hours < 0 || hours > 23 || minutes < 0 || minutes >= 60) return null;
    return hours * 60 + minutes;
  };

  // Función para calcular horas trabajadas totales (normal + extra)
  // Cerrar menús dropdown al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      if (!target.closest(".dropdown-menu") && !target.closest(".dropdown-trigger")) {
        document.querySelectorAll(".dropdown-menu").forEach((menu) => {
          menu.classList.add("hidden");
        });
      }
    };

    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, []);

  return (
    <div className="bg-base-100 space-y-4 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-base-content/70 text-sm">
          <span className="font-semibold">{monthLabel}</span>
          {selectedEmployee && <span className="text-base-content/60 ml-2">· {selectedEmployee.full_name}</span>}
        </div>
        {canEdit && (
          <div className="flex items-center gap-2">
            <Button
              variant="primary"
              disabled={saving || (pendingCount === 0 && modifiedCount === 0)}
              onClick={onBulkSave}
            >
              Guardar cambios
            </Button>
            <div className="text-base-content/60 text-xs">
              {pendingCount > 0 && <span className="mr-2">Pendientes: {pendingCount}</span>}
              {modifiedCount > 0 && <span>Modificados: {modifiedCount}</span>}
            </div>
          </div>
        )}
      </div>

      {canEdit && selectedEmployee?.id && (
        <div className="flex flex-wrap items-center justify-between gap-3">{/* ...existing code... */}</div>
      )}

      <div className="muted-scrollbar transform-gpu overflow-x-auto">
        <table className="min-w-full text-sm will-change-scroll">
          <thead className="bg-primary/10 text-primary sticky top-0 z-10">
            <tr>
              <th className="px-3 py-2 text-left font-semibold whitespace-nowrap">Fecha</th>
              <th className="px-3 py-2 text-left font-semibold whitespace-nowrap">Entrada</th>
              <th className="px-3 py-2 text-left font-semibold whitespace-nowrap">Salida</th>
              <th className="px-3 py-2 text-left font-semibold whitespace-nowrap">Trabajadas</th>
              <th className="px-3 py-2 text-left font-semibold whitespace-nowrap">Extras</th>
              <th className="px-3 py-2 text-left font-semibold whitespace-nowrap">Estado</th>
              <th className="px-3 py-2 text-left font-semibold whitespace-nowrap">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {bulkRows.map((row, index) => {
              // Calcular duración del turno
              const worked = calculateWorkedHours(row.entrada, row.salida);
              const parts = worked.split(":").map(Number);
              const [h, m] = parts;
              const totalHours = (h || 0) + (m || 0) / 60;

              let showWarning = false;
              let warningText = "";
              if (row.entrada && row.salida) {
                if (totalHours < 3) {
                  showWarning = true;
                  warningText = "Turno muy corto (menos de 3 horas)";
                } else if (totalHours > 10) {
                  showWarning = true;
                  warningText = "Turno muy largo (más de 10 horas)";
                }
              }

              const isSunday = dayjs(row.date).day() === 0;
              const canEditRow = canEdit && !isSunday;
              const isMarkedNotWorked = notWorkedDays.has(row.date);
              const dirty = isRowDirty(row, initialRows?.[index]);
              const hasComment = Boolean(row.comment?.trim());

              return (
                <TimesheetRow
                  key={row.date}
                  index={index}
                  row={row}
                  dirty={dirty}
                  canEditRow={canEditRow}
                  isMarkedNotWorked={isMarkedNotWorked}
                  onRowChange={onRowChange}
                  onSalidaBlur={onSalidaBlur}
                  onOpenOvertime={(date) =>
                    setOpenOvertimeEditors((prev) => {
                      const next = new Set(prev);
                      next.add(date);
                      return next;
                    })
                  }
                  onCloseOvertime={(date) =>
                    setOpenOvertimeEditors((prev) => {
                      const next = new Set(prev);
                      next.delete(date);
                      return next;
                    })
                  }
                  isOvertimeOpen={openOvertimeEditors.has(row.date)}
                  showWarning={showWarning}
                  warningText={warningText}
                  hasComment={hasComment}
                  toggleMenu={toggleMenu}
                  setCommentPreview={setCommentPreview}
                  onResetRow={onResetRow}
                  setNotWorkedDays={setNotWorkedDays}
                  onRemoveEntry={onRemoveEntry}
                  worked={worked}
                />
              );
            })}
            {loadingDetail && (
              <tr>
                <td colSpan={7} className="text-base-content/60 px-4 py-6 text-center">
                  <div className="flex items-center justify-center gap-2">
                    <span className={LOADING_SPINNER_SM}></span>
                    <span>Cargando datos...</span>
                  </div>
                </td>
              </tr>
            )}
            {!loadingDetail && !bulkRows.length && (
              <tr>
                <td colSpan={7} className="text-base-content/60 px-4 py-6 text-center">
                  {employeeOptions.length
                    ? "Selecciona un trabajador para ver o editar sus horas."
                    : "Registra a trabajadores activos para comenzar a cargar horas."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {/* Modal para ver comentario */}
      <Modal
        isOpen={Boolean(commentPreview)}
        onClose={() => setCommentPreview(null)}
        title={`Comentario · ${commentPreview ? formatDateLabel(commentPreview.date) : ""}`}
      >
        <p className="text-base-content whitespace-pre-wrap">{commentPreview?.text}</p>
      </Modal>
    </div>
  );
}
