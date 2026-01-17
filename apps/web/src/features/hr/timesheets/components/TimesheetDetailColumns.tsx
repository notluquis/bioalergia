import { createColumnHelper } from "@tanstack/react-table";
import dayjs from "dayjs";

import Button from "@/components/ui/Button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/DropdownMenu";
import TimeInput from "@/components/ui/TimeInput";

import type { BulkRow } from "../types";
import { calculateWorkedMinutes, computeStatus, formatDateLabel, isRowDirty, minutesToDuration } from "../utils";

export interface TimesheetTableMeta {
  canEdit: boolean;
  initialRows: BulkRow[];
  notWorkedDays: Set<string>;
  onRowChange: (index: number, field: keyof Omit<BulkRow, "date" | "entryId">, value: string) => void;
  onSalidaBlur: (index: number) => void;
  onResetRow: (index: number) => void;
  onRemoveEntry: (row: BulkRow) => void;
  onOpenOvertime: (date: string) => void;
  onCloseOvertime: (date: string) => void;
  openOvertimeEditors: Set<string>;
  setNotWorkedDays: (cb: (prev: Set<string>) => Set<string>) => void;
  setCommentPreview: (data: { date: string; text: string } | null) => void;
}

const DateCell = ({ row, meta }: { row: BulkRow; meta: TimesheetTableMeta }) => {
  const dayIdx = dayjs(row.date).day();
  const labels = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
  const isSun = dayIdx === 0;
  const isMarkedNotWorked = meta.notWorkedDays.has(row.date);

  return (
    <div className={`flex items-center gap-2 ${isMarkedNotWorked ? "opacity-60" : ""}`}>
      <span className="text-base-content/70 whitespace-nowrap">{formatDateLabel(row.date)}</span>
      <span
        className={`rounded px-1.5 py-0.5 text-xs font-semibold uppercase ${
          isSun ? "bg-base-300 text-base-content/50" : "bg-base-200 text-base-content/60"
        }`}
      >
        {labels[dayIdx]}
      </span>
    </div>
  );
};

const InputCell = ({
  row,
  index,
  meta,
  field,
}: {
  row: BulkRow;
  index: number;
  meta: TimesheetTableMeta;
  field: "entrada" | "salida";
}) => {
  const isSunday = dayjs(row.date).day() === 0;
  const canEditRow = meta.canEdit && !isSunday;
  const isMarkedNotWorked = meta.notWorkedDays.has(row.date);

  return (
    <div className={isMarkedNotWorked ? "pointer-events-none opacity-60" : ""}>
      <TimeInput
        value={row[field]}
        onChange={(value) => meta.onRowChange(index, field, value)}
        onBlur={() => field === "salida" && meta.onSalidaBlur(index)}
        placeholder="HH:MM"
        className="w-28"
        disabled={!canEditRow}
      />
    </div>
  );
};

const WorkedCell = ({ row, meta }: { row: BulkRow; meta: TimesheetTableMeta }) => {
  const mins = calculateWorkedMinutes(row.entrada, row.salida);
  const duration = minutesToDuration(mins);
  const isMarkedNotWorked = meta.notWorkedDays.has(row.date);

  return <div className={`text-base-content tabular-nums ${isMarkedNotWorked ? "opacity-60" : ""}`}>{duration}</div>;
};

const OvertimeCell = ({ row, index, meta }: { row: BulkRow; index: number; meta: TimesheetTableMeta }) => {
  const isSunday = dayjs(row.date).day() === 0;
  const canEditRow = meta.canEdit && !isSunday;
  const isMarkedNotWorked = meta.notWorkedDays.has(row.date);
  const isOvertimeOpen = meta.openOvertimeEditors.has(row.date);

  if (isMarkedNotWorked) return <span className="opacity-60">—</span>;

  if (!row.overtime?.trim() && !isOvertimeOpen) {
    if (canEditRow) {
      return (
        <Button
          type="button"
          size="sm"
          variant="secondary"
          className="border-base-300 bg-base-200 text-primary hover:bg-base-200 inline-flex h-8 w-8 items-center justify-center rounded-full border shadow"
          aria-label="Agregar horas extra"
          title="Agregar horas extra"
          onClick={() => meta.onOpenOvertime(row.date)}
        >
          +
        </Button>
      );
    }
    return <span className="text-base-content/50">—</span>;
  }

  return (
    <TimeInput
      value={row.overtime}
      onChange={(value) => {
        meta.onRowChange(index, "overtime", value);
        if (!value.trim()) {
          meta.onCloseOvertime(row.date);
        }
      }}
      placeholder="HH:MM"
      className="w-28"
      disabled={!canEditRow}
    />
  );
};

const StatusCell = ({ row, index, meta }: { row: BulkRow; index: number; meta: TimesheetTableMeta }) => {
  const initial = meta.initialRows[index];
  const dirty = isRowDirty(row, initial);
  const status = computeStatus(row, dirty);
  const isMarkedNotWorked = meta.notWorkedDays.has(row.date);

  // Warning Logic
  const mins = calculateWorkedMinutes(row.entrada, row.salida);
  const hours = mins / 60;
  let showWarning = false;
  let warningText = "";
  if (row.entrada && row.salida) {
    if (hours < 3) {
      showWarning = true;
      warningText = "Turno muy corto (< 3h)";
    } else if (hours > 10) {
      showWarning = true;
      warningText = "Turno muy largo (> 10h)";
    }
  }
  const hasComment = Boolean(row.comment?.trim());

  const showBang = showWarning || hasComment;
  const bangColor = showWarning ? "text-error hover:text-error/80" : "text-primary hover:text-primary/80";
  const tooltipParts: string[] = [];
  if (showWarning && warningText) tooltipParts.push(warningText);
  if (hasComment) tooltipParts.push(`Comentario: ${row.comment.trim()}`);

  const statusColor = (() => {
    if (status === "Registrado") return "text-success";
    if (status === "Sin guardar") return "text-warning";
    return "text-base-content/50";
  })();

  return (
    <div
      className={`flex items-center gap-1 text-xs font-semibold tracking-wide uppercase ${statusColor} ${isMarkedNotWorked ? "opacity-60" : ""}`}
    >
      {status}
      {showBang && (
        <div className="group relative">
          <span className={`cursor-help font-bold ${bangColor}`}>!</span>
          <div className="bg-neutral text-neutral-content invisible absolute bottom-full left-1/2 z-50 mb-2 max-w-xs -translate-x-1/2 rounded-lg px-3 py-2 text-xs font-normal tracking-normal whitespace-nowrap normal-case shadow-lg group-hover:visible">
            {tooltipParts.map((part, i) => (
              <span key={i} className="block">
                {part}
              </span>
            ))}
            <span className="border-t-neutral absolute top-full left-1/2 h-0 w-0 -translate-x-1/2 border-t-4 border-r-4 border-l-4 border-transparent"></span>
          </div>
        </div>
      )}
    </div>
  );
};

const ActionsCell = ({ row, index, meta }: { row: BulkRow; index: number; meta: TimesheetTableMeta }) => {
  const isSunday = dayjs(row.date).day() === 0;
  const canEditRow = meta.canEdit && !isSunday;
  const initial = meta.initialRows[index];
  const dirty = isRowDirty(row, initial);
  const isMarkedNotWorked = meta.notWorkedDays.has(row.date);

  if (!canEditRow) return <span className="text-base-content/50 text-xs">—</span>;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="secondary" size="sm" className="h-8 w-8 p-0">
          ⋯
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem
          onClick={() => meta.setCommentPreview({ date: row.date, text: row.comment || "(Sin comentario)" })}
        >
          Ver comentario
        </DropdownMenuItem>

        {dirty && <DropdownMenuItem onClick={() => meta.onResetRow(index)}>Deshacer cambios</DropdownMenuItem>}

        <DropdownMenuItem
          onClick={() => {
            meta.setNotWorkedDays((prev) => {
              const next = new Set(prev);
              if (next.has(row.date)) next.delete(row.date);
              else next.add(row.date);
              return next;
            });
          }}
        >
          {isMarkedNotWorked ? "Marcar como trabajado" : "Día no trabajado"}
        </DropdownMenuItem>

        {row.entryId && (
          <DropdownMenuItem className="text-error focus:text-error" onClick={() => meta.onRemoveEntry(row)}>
            Eliminar registro
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

const columnHelper = createColumnHelper<BulkRow>();

export const getTimesheetDetailColumns = () => [
  columnHelper.accessor("date", {
    header: "Fecha",
    cell: ({ row, table }) => <DateCell row={row.original} meta={table.options.meta as TimesheetTableMeta} />,
  }),
  columnHelper.accessor("entrada", {
    header: "Entrada",
    cell: ({ row, table }) => (
      <InputCell row={row.original} index={row.index} field="entrada" meta={table.options.meta as TimesheetTableMeta} />
    ),
  }),
  columnHelper.accessor("salida", {
    header: "Salida",
    cell: ({ row, table }) => (
      <InputCell row={row.original} index={row.index} field="salida" meta={table.options.meta as TimesheetTableMeta} />
    ),
  }),
  columnHelper.display({
    id: "trabajadas",
    header: "Trabajadas",
    cell: ({ row, table }) => <WorkedCell row={row.original} meta={table.options.meta as TimesheetTableMeta} />,
  }),
  columnHelper.accessor("overtime", {
    header: "Extras",
    cell: ({ row, table }) => (
      <OvertimeCell row={row.original} index={row.index} meta={table.options.meta as TimesheetTableMeta} />
    ),
  }),
  columnHelper.display({
    id: "status",
    header: "Estado",
    cell: ({ row, table }) => (
      <StatusCell row={row.original} index={row.index} meta={table.options.meta as TimesheetTableMeta} />
    ),
  }),
  columnHelper.display({
    id: "actions",
    header: "Acciones",
    cell: ({ row, table }) => (
      <ActionsCell row={row.original} index={row.index} meta={table.options.meta as TimesheetTableMeta} />
    ),
  }),
];
