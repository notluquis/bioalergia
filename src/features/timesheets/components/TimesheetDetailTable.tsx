import dayjs from "dayjs";
import { useAuth } from "../../../context/AuthContext";
import { useEffect, useState, type ChangeEvent } from "react";
import Modal from "../../../components/Modal";
import Button from "../../../components/Button";
import Input from "../../../components/Input";
import TimeInput from "../../../components/TimeInput";
import { computeStatus, isRowDirty, formatDateLabel } from "../utils";
import type { BulkRow } from "../types";
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
    <div className="space-y-4 p-6 bg-base-100">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-base-content/70">
          <span className="font-semibold">{monthLabel}</span>
          {selectedEmployee && <span className="ml-2 text-base-content/60">· {selectedEmployee.full_name}</span>}
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
            <div className="text-xs text-base-content/60">
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

              if (h === undefined || m === undefined) return "";
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
              const bangColor = showWarning ? "text-red-600 hover:text-red-800" : "text-primary hover:text-primary/80";
              const tooltipParts: string[] = [];
              if (showWarning && warningText) tooltipParts.push(warningText);
              if (hasComment) tooltipParts.push(`Comentario: ${row.comment.trim()}`);
              const bangTitle = tooltipParts.join(" — ");

              const isMarkedNotWorked = notWorkedDays.has(row.date);
              // determine whether this row is dirty compared to initial values
              const dirty = isRowDirty(row, initialRows?.[index]);
              const status = computeStatus(row, dirty);
              const statusColor =
                status === "Registrado"
                  ? "text-success"
                  : status === "Sin guardar"
                    ? "text-warning"
                    : "text-base-content/50";
              return (
                <tr
                  key={row.date}
                  className={`odd:bg-base-200/60 hover:bg-base-300/80 transition-colors ${
                    isMarkedNotWorked ? "opacity-60 pointer-events-none" : ""
                  }`}
                >
                  {/* Fecha */}
                  <td className="px-3 py-2 text-base-content/70 whitespace-nowrap">
                    {formatDateLabel(row.date)}
                    {(() => {
                      const dayIdx = dayjs(row.date).day();
                      const labels = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
                      const isSun = dayIdx === 0;
                      return (
                        <span
                          className={`ml-2 rounded px-1.5 py-0.5 text-xs font-semibold uppercase ${
                            isSun ? "bg-base-300 text-base-content/50" : "bg-base-200 text-base-content/60"
                          }`}
                        >
                          {labels[dayIdx]}
                        </span>
                      );
                    })()}
                  </td>
                  {/* Entrada */}
                  <td className="px-3 py-2">
                    <TimeInput
                      value={row.entrada}
                      onChange={(value) => onRowChange(index, "entrada", value)}
                      placeholder="HH:MM"
                      className="w-28"
                      disabled={!canEditRow}
                    />
                  </td>
                  {/* Salida */}
                  <td className="px-3 py-2">
                    <TimeInput
                      value={row.salida}
                      onChange={(value) => onRowChange(index, "salida", value)}
                      placeholder="HH:MM"
                      className="w-28"
                      disabled={!canEditRow}
                    />
                  </td>
                  {/* Trabajadas */}
                  <td className="px-3 py-2 text-base-content tabular-nums">{worked}</td>
                  {/* Extras */}
                  <td className="px-3 py-2">
                    {!row.overtime?.trim() && !openOvertimeEditors.has(row.date) ? (
                      canEditRow ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-base-300 bg-base-200 text-primary shadow hover:bg-base-200"
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
                        </Button>
                      ) : (
                        <span className="text-base-content/50">—</span>
                      )
                    ) : (
                      <Input
                        type="text"
                        value={row.overtime}
                        onChange={(event: ChangeEvent<HTMLInputElement>) =>
                          onRowChange(index, "overtime", event.target.value)
                        }
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
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          className="dropdown-trigger"
                          aria-haspopup="true"
                          aria-expanded="false"
                          onClick={() => toggleMenu(`menu-${row.date}`)}
                          title="Acciones"
                        >
                          ⋯
                        </Button>
                        <div
                          id={`menu-${row.date}`}
                          className="dropdown-menu hidden absolute right-0 z-20 mt-2 w-44 origin-top-right rounded-xl bg-base-100 p-1 shadow-xl ring-1 ring-black/5"
                          role="menu"
                        >
                          <Button
                            variant="secondary"
                            size="sm"
                            className="w-full rounded-lg px-3 py-2 text-left text-sm text-base-content hover:bg-base-200"
                            role="menuitem"
                            onClick={() => {
                              toggleMenu(`menu-${row.date}`);
                              setCommentPreview({ date: row.date, text: row.comment || "(Sin comentario)" });
                            }}
                          >
                            Ver comentario
                          </Button>
                          {dirty && (
                            <Button
                              variant="secondary"
                              size="sm"
                              className="w-full rounded-lg px-3 py-2 text-left text-sm text-base-content hover:bg-base-200"
                              role="menuitem"
                              onClick={() => {
                                onResetRow(index);
                                toggleMenu(`menu-${row.date}`);
                              }}
                            >
                              Deshacer cambios
                            </Button>
                          )}
                          <Button
                            variant="secondary"
                            size="sm"
                            className="w-full rounded-lg px-3 py-2 text-left text-sm text-base-content hover:bg-base-200"
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
                          </Button>
                          {row.entryId && (
                            <Button
                              variant="secondary"
                              size="sm"
                              className="w-full rounded-lg px-3 py-2 text-left text-sm text-error hover:bg-error/10"
                              role="menuitem"
                              onClick={() => {
                                toggleMenu(`menu-${row.date}`);
                                onRemoveEntry(row);
                              }}
                            >
                              Eliminar registro
                            </Button>
                          )}
                          {!dirty && !row.entryId && (
                            <div className="px-3 py-2 text-xs text-base-content/50">Sin acciones</div>
                          )}
                        </div>
                      </div>
                    ) : (
                      <span className="text-xs text-base-content/50">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
            {!loadingDetail && !bulkRows.length && (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-base-content/60">
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
        <p className="whitespace-pre-wrap text-base-content">{commentPreview?.text}</p>
      </Modal>
    </div>
  );
}
