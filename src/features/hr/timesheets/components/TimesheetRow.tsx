import dayjs from "dayjs";
import { memo } from "react";

import Button from "@/components/ui/Button";
import TimeInput from "@/components/ui/TimeInput";

import type { BulkRow } from "../types";
import { computeStatus, formatDateLabel } from "../utils";

interface TimesheetRowProps {
  index: number;
  row: BulkRow;
  dirty: boolean;
  canEditRow: boolean;
  isMarkedNotWorked: boolean;
  onRowChange: (index: number, field: keyof Omit<BulkRow, "date" | "entryId">, value: string) => void;
  onSalidaBlur: (index: number) => void;
  onOpenOvertime: (date: string) => void;
  onCloseOvertime: (date: string) => void;
  isOvertimeOpen: boolean;
  showWarning: boolean;
  warningText: string;
  hasComment: boolean;
  toggleMenu: (id: string) => void;
  setCommentPreview: (data: { date: string; text: string }) => void;
  onResetRow: (index: number) => void;
  setNotWorkedDays: (cb: (prev: Set<string>) => Set<string>) => void;
  onRemoveEntry: (row: BulkRow) => void;
  worked: string;
}

function TimesheetRow({
  index,
  row,
  dirty,
  canEditRow,
  isMarkedNotWorked,
  onRowChange,
  onSalidaBlur,
  onOpenOvertime,
  onCloseOvertime,
  isOvertimeOpen,
  showWarning,
  warningText,
  hasComment,
  toggleMenu,
  setCommentPreview,
  onResetRow,
  setNotWorkedDays,
  onRemoveEntry,
  worked,
}: TimesheetRowProps) {
  const showBang = showWarning || hasComment;
  const bangColor = showWarning ? "text-error hover:text-error/80" : "text-primary hover:text-primary/80";
  const tooltipParts: string[] = [];
  if (showWarning && warningText) tooltipParts.push(warningText);
  if (hasComment) tooltipParts.push(`Comentario: ${row.comment.trim()}`);

  const status = computeStatus(row, dirty);
  const statusColor =
    status === "Registrado" ? "text-success" : status === "Sin guardar" ? "text-warning" : "text-base-content/50";

  return (
    <tr
      className={`odd:bg-base-200/60 hover:bg-base-300/80 transition-colors ${
        isMarkedNotWorked ? "pointer-events-none opacity-60" : ""
      }`}
    >
      {/* Fecha */}
      <td className="text-base-content/70 px-3 py-2 whitespace-nowrap">
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
          onBlur={() => onSalidaBlur(index)}
          placeholder="HH:MM"
          className="w-28"
          disabled={!canEditRow}
        />
      </td>
      {/* Trabajadas */}
      <td className="text-base-content px-3 py-2 tabular-nums">{worked}</td>
      {/* Extras */}
      <td className="px-3 py-2">
        {!row.overtime?.trim() && !isOvertimeOpen ? (
          canEditRow ? (
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="border-base-300 bg-base-200 text-primary hover:bg-base-200 inline-flex h-8 w-8 items-center justify-center rounded-full border shadow"
              aria-label="Agregar horas extra"
              title="Agregar horas extra"
              onClick={() => onOpenOvertime(row.date)}
            >
              +
            </Button>
          ) : (
            <span className="text-base-content/50">—</span>
          )
        ) : (
          <TimeInput
            value={row.overtime}
            onChange={(value) => {
              onRowChange(index, "overtime", value);
              if (!value.trim()) {
                onCloseOvertime(row.date);
              }
            }}
            placeholder="HH:MM"
            className="w-28"
            disabled={!canEditRow}
          />
        )}
      </td>
      {/* Estado + indicador unificado "!" */}
      <td className={`px-3 py-2 text-xs font-semibold tracking-wide uppercase ${statusColor} relative`}>
        <span className="inline-flex items-center gap-1">
          {status}
          {showBang && (
            <span className="group relative">
              <span className={`cursor-help font-bold ${bangColor}`}>!</span>
              <span className="bg-neutral text-neutral-content invisible absolute bottom-full left-1/2 z-50 mb-2 max-w-xs -translate-x-1/2 rounded-lg px-3 py-2 text-xs font-normal tracking-normal whitespace-nowrap normal-case shadow-lg group-hover:visible">
                {tooltipParts.map((part, i) => (
                  <span key={i} className="block">
                    {part}
                  </span>
                ))}
                <span className="border-t-neutral absolute top-full left-1/2 h-0 w-0 -translate-x-1/2 border-t-4 border-r-4 border-l-4 border-transparent"></span>
              </span>
            </span>
          )}
        </span>
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
              className="dropdown-menu bg-base-100 absolute right-0 z-20 mt-2 hidden w-48 origin-top-right rounded-xl p-2 shadow-xl ring-1 ring-black/5"
              role="menu"
            >
              <Button
                variant="ghost"
                size="sm"
                className="text-base-content hover:bg-base-200 w-full justify-start rounded-lg px-3 py-2.5 text-left text-sm"
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
                  variant="ghost"
                  size="sm"
                  className="text-base-content hover:bg-base-200 w-full justify-start rounded-lg px-3 py-2.5 text-left text-sm"
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
                variant="ghost"
                size="sm"
                className="text-base-content hover:bg-base-200 w-full justify-start rounded-lg px-3 py-2.5 text-left text-sm"
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
                  variant="ghost"
                  size="sm"
                  className="text-error hover:bg-error/10 w-full justify-start rounded-lg px-3 py-2.5 text-left text-sm"
                  role="menuitem"
                  onClick={() => {
                    toggleMenu(`menu-${row.date}`);
                    onRemoveEntry(row);
                  }}
                >
                  Eliminar registro
                </Button>
              )}
              {!dirty && !row.entryId && <div className="text-base-content/50 px-3 py-2.5 text-xs">Sin acciones</div>}
            </div>
          </div>
        ) : (
          <span className="text-base-content/50 text-xs">—</span>
        )}
      </td>
    </tr>
  );
}

export default memo(TimesheetRow);
