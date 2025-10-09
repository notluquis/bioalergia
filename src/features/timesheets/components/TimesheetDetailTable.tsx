import dayjs from "dayjs";
import { useAuth } from "../../../context/AuthContext";
import { useEffect, useState } from "react";
import Modal from "../../../components/Modal";
import Button from "../../../components/Button";
import Input from "../../../components/Input";
import { computeStatus, hasRowData, isRowDirty, parseDuration, computeExtraAmount, formatDateLabel } from "../utils";
import type { BulkRow, TimesheetEntry } from "../types";
import type { Employee } from "../../employees/types";

interface TimesheetDetailTableProps {
  bulkRows: BulkRow[];
  initialRows: BulkRow[];
  loadingDetail: boolean;
  selectedEmployee: Employee | null;
  onRowChange: (index: number, field: keyof Omit<BulkRow, "date" | "entryId">, value: string) => void;
  onResetRow: (index: number) => void;
  onRemoveEntry: (row: BulkRow) => void;
  onBulkSave: () => void;
  saving: boolean;
  pendingCount: number;
  modifiedCount: number;
  monthLabel: string;
  employeeOptions: Employee[];
  setSelectedEmployeeId: (id: number) => void;
}

export default function TimesheetDetailTable({
  bulkRows,
  initialRows,
  loadingDetail,
  selectedEmployee,
  onRowChange,
  onResetRow,
  onRemoveEntry,
  onBulkSave,
  saving,
  pendingCount,
  modifiedCount,
  monthLabel,
  employeeOptions,
  setSelectedEmployeeId,
}: TimesheetDetailTableProps) {
  const { hasRole } = useAuth();
  const canEdit = hasRole("GOD", "ADMIN", "ANALYST");
  const [openOvertimeEditors, setOpenOvertimeEditors] = useState<Set<string>>(new Set());
  const [commentPreview, setCommentPreview] = useState<{ date: string; text: string } | null>(null);
  const [notWorkedDays, setNotWorkedDays] = useState<Set<string>>(new Set());

  // Toggle helper for per-row actions menu
  const toggleMenu = (id: string) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.toggle("hidden");
  };

  // Función para autocompletar hora (ej: "10" -> "10:00", "930" -> "09:30")
  const formatTimeInput = (value: string) => {
    if (!value.trim()) return "";

    // Si ya está en formato HH:MM, validar y devolver
    if (/^[0-9]{1,2}:[0-9]{2}$/.test(value)) {
      const [hours, minutes] = value.split(":").map(Number);
      if (hours >= 0 && hours <= 23 && minutes >= 0 && minutes < 60) {
        return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`;
      }
      return value;
    }

    // Autocompletar números (ej: "10" -> "10:00", "930" -> "09:30")
    const cleaned = value.replace(/[^0-9]/g, "");
    if (cleaned.length === 0) return "";

    if (cleaned.length === 1 || cleaned.length === 2) {
      const hours = parseInt(cleaned, 10);
      if (hours >= 0 && hours <= 23) {
        return `${hours.toString().padStart(2, "0")}:00`;
      }
    } else if (cleaned.length === 3 || cleaned.length === 4) {
      const hours = parseInt(cleaned.slice(0, -2), 10);
      const minutes = parseInt(cleaned.slice(-2), 10);
      if (hours >= 0 && hours <= 23 && minutes >= 0 && minutes < 60) {
        return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`;
      }
    }

    return value;
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
    const [hours, minutes] = time.split(":").map(Number);
    if (hours < 0 || hours > 23 || minutes < 0 || minutes >= 60) return null;
    return hours * 60 + minutes;
  };

  // Función para calcular horas trabajadas totales (normal + extra)
  const calculateTotalHours = (worked: string, overtime: string) => {
    const workedMinutes = parseDuration(worked) || 0;
    const overtimeMinutes = parseDuration(overtime) || 0;
    const totalMinutes = workedMinutes + overtimeMinutes;

    if (totalMinutes === 0) return "00:00";

    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`;
  };

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
    <div className="space-y-4 glass-card glass-underlay-gradient p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-slate-600">
          <span className="font-semibold">{monthLabel}</span>
          {selectedEmployee && <span className="ml-2 text-slate-500">· {selectedEmployee.full_name}</span>}
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
            <div className="text-xs text-slate-500">
              {pendingCount > 0 && <span className="mr-2">Pendientes: {pendingCount}</span>}
              {modifiedCount > 0 && <span>Modificados: {modifiedCount}</span>}
            </div>
          </div>
        )}
      </div>

      {canEdit && selectedEmployee?.id && (
        <div className="flex flex-wrap items-center justify-between gap-3">{/* ...existing code... */}</div>
      )}

      <div className="overflow-x-auto muted-scrollbar transform-gpu">
        <table className="min-w-full text-sm will-change-scroll">
          <thead className="bg-[var(--brand-primary)]/10 text-[var(--brand-primary)] sticky top-0 z-10">
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
            {loadingDetail && (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-[var(--brand-primary)]">
                  Cargando detalle...
                </td>
              </tr>
            )}
            {!loadingDetail &&
              bulkRows.map((row, index) => {
                const initial = initialRows[index];
                const dirty = isRowDirty(row, initial);
                const status = computeStatus(row, dirty);
                const statusColor =
                  status === "Registrado"
                    ? "text-emerald-600"
                    : status === "Pendiente"
                      ? "text-slate-400"
                      : status === "Sin guardar"
                        ? "text-amber-600"
                        : "text-slate-600";

                // Calcular duración del turno
                const worked = calculateWorkedHours(row.entrada, row.salida);
                const [h, m] = worked.split(":").map(Number);
                const totalHours = h + m / 60;
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

                // Unificado: un solo "!" para warning y comentario
                const hasComment = Boolean(row.comment?.trim());
                const showBang = showWarning || hasComment;
                const bangColor = showWarning
                  ? "text-red-600 hover:text-red-800"
                  : "text-[var(--brand-primary)] hover:text-[var(--brand-primary)]/80";
                const tooltipParts: string[] = [];
                if (showWarning && warningText) tooltipParts.push(warningText);
                if (hasComment) tooltipParts.push(`Comentario: ${row.comment.trim()}`);
                const bangTitle = tooltipParts.join(" — ");

                const isMarkedNotWorked = notWorkedDays.has(row.date);
                return (
                  <tr
                    key={row.date}
                    className={`odd:bg-slate-50/60 hover:bg-slate-100/80 transition-colors ${
                      isMarkedNotWorked ? "opacity-60 pointer-events-none" : ""
                    }`}
                  >
                    {/* Fecha */}
                    <td className="px-3 py-2 text-slate-600 whitespace-nowrap">
                      {formatDateLabel(row.date)}
                      {(() => {
                        const dayIdx = dayjs(row.date).day();
                        const labels = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
                        const isSun = dayIdx === 0;
                        return (
                          <span
                            className={`ml-2 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${
                              isSun ? "bg-slate-100 text-slate-400" : "bg-slate-50 text-slate-500"
                            }`}
                          >
                            {labels[dayIdx]}
                          </span>
                        );
                      })()}
                    </td>
                    {/* Entrada */}
                    <td className="px-3 py-2">
                      <Input
                        type="text"
                        value={row.entrada}
                        onChange={(e) => onRowChange(index, "entrada", formatTimeInput(e.target.value))}
                        placeholder="HH:MM"
                        className="w-28"
                        disabled={!canEditRow}
                      />
                    </td>
                    {/* Salida */}
                    <td className="px-3 py-2">
                      <Input
                        type="text"
                        value={row.salida}
                        onChange={(e) => onRowChange(index, "salida", formatTimeInput(e.target.value))}
                        placeholder="HH:MM"
                        className="w-28"
                        disabled={!canEditRow}
                      />
                    </td>
                    {/* Trabajadas */}
                    <td className="px-3 py-2 text-slate-700 tabular-nums">{worked}</td>
                    {/* Extras */}
                    <td className="px-3 py-2">
                      {!row.overtime?.trim() && !openOvertimeEditors.has(row.date) ? (
                        canEditRow ? (
                          <button
                            type="button"
                            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/60 bg-white/70 text-[var(--brand-primary)] shadow hover:bg-white/90"
                            aria-label="Agregar horas extra"
                            title="Agregar horas extra"
                            onClick={() =>
                              setOpenOvertimeEditors((prev) => {
                                const next = new Set(prev);
                                next.add(row.date);
                                return next;
                              })
                            }
                          >
                            +
                          </button>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )
                      ) : (
                        <Input
                          type="text"
                          value={row.overtime}
                          onChange={(e) => onRowChange(index, "overtime", e.target.value)}
                          placeholder="HH:MM"
                          className="w-28"
                          disabled={!canEditRow}
                          onBlur={() => {
                            const value = (row.overtime || "").trim();
                            if (!value) {
                              setOpenOvertimeEditors((prev) => {
                                const next = new Set(prev);
                                next.delete(row.date);
                                return next;
                              });
                            }
                          }}
                        />
                      )}
                    </td>
                    {/* Estado + indicador unificado "!" */}
                    <td className={`px-3 py-2 text-xs font-semibold uppercase tracking-wide ${statusColor} relative`}>
                      {status}
                      {showBang && (
                        <span title={bangTitle} className={`ml-2 font-bold cursor-help ${bangColor}`}>
                          !
                        </span>
                      )}
                    </td>
                    {/* Acciones (menú de tres puntos) */}
                    <td className="px-3 py-2">
                      {canEditRow ? (
                        <div className="relative inline-block text-left">
                          <button
                            type="button"
                            className="dropdown-trigger inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/60 bg-white/70 text-slate-500 shadow hover:bg-white/90 hover:text-slate-700"
                            aria-haspopup="true"
                            aria-expanded="false"
                            onClick={() => toggleMenu(`menu-${row.date}`)}
                            title="Acciones"
                          >
                            ⋯
                          </button>
                          <div
                            id={`menu-${row.date}`}
                            className="dropdown-menu hidden absolute right-0 z-20 mt-2 w-44 origin-top-right rounded-xl bg-white p-1 shadow-xl ring-1 ring-black/5"
                            role="menu"
                          >
                            <button
                              className="w-full rounded-lg px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                              role="menuitem"
                              onClick={() => {
                                toggleMenu(`menu-${row.date}`);
                                setCommentPreview({ date: row.date, text: row.comment || "(Sin comentario)" });
                              }}
                            >
                              Ver comentario
                            </button>
                            {dirty && (
                              <button
                                className="w-full rounded-lg px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                                role="menuitem"
                                onClick={() => {
                                  onResetRow(index);
                                  toggleMenu(`menu-${row.date}`);
                                }}
                              >
                                Deshacer cambios
                              </button>
                            )}
                            <button
                              className="w-full rounded-lg px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                              role="menuitem"
                              onClick={() => {
                                toggleMenu(`menu-${row.date}`);
                                setNotWorkedDays((prev) => {
                                  const next = new Set(prev);
                                  if (next.has(row.date)) next.delete(row.date);
                                  else next.add(row.date);
                                  return next;
                                });
                              }}
                            >
                              {isMarkedNotWorked ? "Marcar como trabajado" : "Día no trabajado"}
                            </button>
                            {row.entryId && (
                              <button
                                className="w-full rounded-lg px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50"
                                role="menuitem"
                                onClick={() => {
                                  toggleMenu(`menu-${row.date}`);
                                  onRemoveEntry(row);
                                }}
                              >
                                Eliminar registro
                              </button>
                            )}
                            {!dirty && !row.entryId && (
                              <div className="px-3 py-2 text-xs text-slate-400">Sin acciones</div>
                            )}
                          </div>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            {!loadingDetail && !bulkRows.length && (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-slate-500">
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
        <p className="whitespace-pre-wrap text-slate-700">{commentPreview?.text}</p>
      </Modal>
    </div>
  );
}
