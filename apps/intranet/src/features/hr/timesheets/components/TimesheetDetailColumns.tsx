import { createColumnHelper } from "@tanstack/react-table";
import dayjs from "dayjs";

import { Button } from "@/components/ui/Button";
import {
  DropdownMenu,
  DropdownMenuItem,
  DropdownPopover,
  HeroDropdownMenu,
} from "@/components/ui/DropdownMenu";
import { TimeInput } from "@/components/ui/TimeInput";
import { Tooltip } from "@/components/ui/Tooltip";

import type { BulkRow } from "../types";

import {
  calculateWorkedMinutes,
  computeStatus,
  formatDateLabel,
  isRowDirty,
  minutesToDuration,
} from "../utils";

export interface TimesheetTableMeta {
  canEdit: boolean;
  initialRows: BulkRow[];
  notWorkedDays: Set<string>;
  onCloseOvertime: (date: Date) => void;
  onOpenOvertime: (date: Date) => void;
  onRemoveEntry: (row: BulkRow) => void;
  onResetRow: (index: number) => void;
  onRowChange: (
    index: number,
    field: keyof Omit<BulkRow, "date" | "entryId">,
    value: string,
  ) => void;
  onSalidaBlur: (index: number) => void;
  openOvertimeEditors: Set<string>;
  setCommentPreview: (data: null | { date: Date; text: string }) => void;
  setNotWorkedDays: (cb: (prev: Set<string>) => Set<string>) => void;
}

const DateCell = ({ meta, row }: { meta: TimesheetTableMeta; row: BulkRow }) => {
  const dateKey = row.date ? dayjs(row.date).format("YYYY-MM-DD") : "";
  const dayIdx = dayjs(row.date).day();
  const labels = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
  const isSun = dayIdx === 0;
  const isMarkedNotWorked = meta.notWorkedDays.has(dateKey);

  return (
    <div className={`flex items-center gap-2 ${isMarkedNotWorked ? "opacity-60" : ""}`}>
      <span className="whitespace-nowrap text-default-600 text-xs sm:text-sm">
        {formatDateLabel(row.date)}
      </span>
      <span
        className={`rounded px-1.5 py-0.5 font-semibold text-xs uppercase ${
          isSun ? "bg-default-100 text-default-400" : "bg-default-50 text-default-500"
        }`}
      >
        {labels[dayIdx]}
      </span>
    </div>
  );
};

const InputCell = ({
  field,
  index,
  meta,
  row,
}: {
  field: "entrada" | "salida";
  index: number;
  meta: TimesheetTableMeta;
  row: BulkRow;
}) => {
  const dateKey = row.date ? dayjs(row.date).format("YYYY-MM-DD") : "";
  const isSunday = dayjs(row.date).day() === 0;
  const canEditRow = meta.canEdit && !isSunday;
  const isMarkedNotWorked = meta.notWorkedDays.has(dateKey);

  return (
    <div className={isMarkedNotWorked ? "pointer-events-none opacity-60" : ""}>
      <TimeInput
        className="w-24 sm:w-28"
        disabled={!canEditRow}
        onBlur={() => field === "salida" && meta.onSalidaBlur(index)}
        onChange={(value) => {
          meta.onRowChange(index, field, value);
        }}
        placeholder="HH:MM"
        value={row[field]}
      />
    </div>
  );
};

const WorkedCell = ({ meta, row }: { meta: TimesheetTableMeta; row: BulkRow }) => {
  const dateKey = row.date ? dayjs(row.date).format("YYYY-MM-DD") : "";
  const mins = calculateWorkedMinutes(row.entrada, row.salida);
  const duration = minutesToDuration(mins);
  const isMarkedNotWorked = meta.notWorkedDays.has(dateKey);

  return (
    <div className={`text-foreground tabular-nums ${isMarkedNotWorked ? "opacity-60" : ""}`}>
      {duration}
    </div>
  );
};

const OvertimeCell = ({
  index,
  meta,
  row,
}: {
  index: number;
  meta: TimesheetTableMeta;
  row: BulkRow;
}) => {
  const dateKey = row.date ? dayjs(row.date).format("YYYY-MM-DD") : "";
  const isSunday = dayjs(row.date).day() === 0;
  const canEditRow = meta.canEdit && !isSunday;
  const isMarkedNotWorked = meta.notWorkedDays.has(dateKey);
  const isOvertimeOpen = meta.openOvertimeEditors.has(dateKey);

  if (isMarkedNotWorked) {
    return <span className="opacity-60">—</span>;
  }

  if (!row.overtime?.trim() && !isOvertimeOpen) {
    if (canEditRow) {
      return (
        <Tooltip content="Agregar horas extra">
          <Button
            aria-label="Agregar horas extra"
            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-default-200 bg-default-50 text-primary shadow hover:bg-default-50"
            onClick={() => {
              if (row.date) {
                meta.onOpenOvertime(row.date);
              }
            }}
            size="sm"
            type="button"
            variant="secondary"
          >
            +
          </Button>
        </Tooltip>
      );
    }
    return <span className="text-default-400">—</span>;
  }

  return (
    <TimeInput
      className="w-24 sm:w-28"
      disabled={!canEditRow}
      onChange={(value) => {
        meta.onRowChange(index, "overtime", value);
        if (!value.trim()) {
          if (row.date) {
            meta.onCloseOvertime(row.date);
          }
        }
      }}
      placeholder="HH:MM"
      value={row.overtime}
    />
  );
};

const StatusCell = ({
  index,
  meta,
  row,
}: {
  index: number;
  meta: TimesheetTableMeta;
  row: BulkRow;
}) => {
  const initial = meta.initialRows[index];
  const dirty = isRowDirty(row, initial);
  const status = computeStatus(row, dirty);
  const dateKey = row.date ? dayjs(row.date).format("YYYY-MM-DD") : "";
  const isMarkedNotWorked = meta.notWorkedDays.has(dateKey);

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
  const bangColor = showWarning
    ? "text-danger hover:text-danger/80"
    : "text-primary hover:text-primary/80";
  const tooltipParts: string[] = [];
  if (showWarning && warningText) {
    tooltipParts.push(warningText);
  }
  if (hasComment) {
    tooltipParts.push(`Comentario: ${row.comment.trim()}`);
  }

  const tooltipContent = (
    <div className="max-w-xs space-y-1 text-xs">
      {tooltipParts.map((part) => (
        <span className="block" key={part}>
          {part}
        </span>
      ))}
    </div>
  );

  const statusColor = (() => {
    if (status === "Registrado") {
      return "text-success";
    }
    if (status === "Sin guardar") {
      return "text-warning";
    }
    return "text-default-400";
  })();

  return (
    <div
      className={`flex items-center gap-1 font-semibold text-xs uppercase tracking-wide ${statusColor} ${isMarkedNotWorked ? "opacity-60" : ""}`}
    >
      {status}
      {showBang && (
        <Tooltip content={tooltipContent} placement="top" showArrow>
          <Button
            aria-label="Ver detalles"
            className={`cursor-help font-bold ${bangColor}`}
            type="button"
            variant="ghost"
            size="sm"
            isIconOnly
          >
            !
          </Button>
        </Tooltip>
      )}
    </div>
  );
};

const ActionsCell = ({
  index,
  meta,
  row,
}: {
  index: number;
  meta: TimesheetTableMeta;
  row: BulkRow;
}) => {
  const isSunday = dayjs(row.date).day() === 0;
  const canEditRow = meta.canEdit && !isSunday;
  const initial = meta.initialRows[index];
  const dirty = isRowDirty(row, initial);
  const dateKey = row.date ? dayjs(row.date).format("YYYY-MM-DD") : "";
  const isMarkedNotWorked = meta.notWorkedDays.has(dateKey);

  if (!canEditRow) {
    return <span className="text-default-400 text-xs">—</span>;
  }

  return (
    <DropdownMenu>
      <Button
        aria-label="Acciones"
        className="h-8 w-8 p-0"
        isIconOnly
        size="sm"
        variant="secondary"
      >
        ⋯
      </Button>
      <DropdownPopover placement="bottom end">
        <HeroDropdownMenu aria-label="Acciones de registro">
          <DropdownMenuItem
            onPress={() => {
              if (row.date) {
                meta.setCommentPreview({ date: row.date, text: row.comment || "(Sin comentario)" });
              }
            }}
          >
            Ver comentario
          </DropdownMenuItem>

          {dirty && (
            <DropdownMenuItem
              onPress={() => {
                meta.onResetRow(index);
              }}
            >
              Deshacer cambios
            </DropdownMenuItem>
          )}

          <DropdownMenuItem
            onPress={() => {
              meta.setNotWorkedDays((prev) => {
                const next = new Set(prev);
                if (!dateKey) {
                  return next;
                }
                if (next.has(dateKey)) {
                  next.delete(dateKey);
                } else {
                  next.add(dateKey);
                }
                return next;
              });
            }}
          >
            {isMarkedNotWorked ? "Marcar como trabajado" : "Día no trabajado"}
          </DropdownMenuItem>

          {row.entryId && (
            <DropdownMenuItem
              className="text-danger focus:text-danger"
              onPress={() => {
                meta.onRemoveEntry(row);
              }}
            >
              Eliminar registro
            </DropdownMenuItem>
          )}
        </HeroDropdownMenu>
      </DropdownPopover>
    </DropdownMenu>
  );
};

const columnHelper = createColumnHelper<BulkRow>();

export const getTimesheetDetailColumns = () => [
  columnHelper.accessor("date", {
    cell: ({ row, table }) => (
      <DateCell meta={table.options.meta as TimesheetTableMeta} row={row.original} />
    ),

    header: "Fecha",
    maxSize: 200,
    minSize: 160,
    size: 180,
  }),
  columnHelper.accessor("entrada", {
    cell: ({ row, table }) => (
      <InputCell
        field="entrada"
        index={row.index}
        meta={table.options.meta as TimesheetTableMeta}
        row={row.original}
      />
    ),

    header: "Inicio",
    maxSize: 130,
    minSize: 100,
    size: 110,
  }),
  columnHelper.accessor("salida", {
    cell: ({ row, table }) => (
      <InputCell
        field="salida"
        index={row.index}
        meta={table.options.meta as TimesheetTableMeta}
        row={row.original}
      />
    ),

    header: "Término",
    maxSize: 130,
    minSize: 100,
    size: 110,
  }),
  columnHelper.display({
    cell: ({ row, table }) => (
      <WorkedCell meta={table.options.meta as TimesheetTableMeta} row={row.original} />
    ),

    header: "Trabajadas",
    id: "trabajadas",
    maxSize: 120,
    minSize: 90,
    size: 100,
  }),
  columnHelper.accessor("overtime", {
    cell: ({ row, table }) => (
      <OvertimeCell
        index={row.index}
        meta={table.options.meta as TimesheetTableMeta}
        row={row.original}
      />
    ),

    header: "Extras",
    maxSize: 120,
    minSize: 90,
    size: 100,
  }),
  columnHelper.display({
    cell: ({ row, table }) => (
      <StatusCell
        index={row.index}
        meta={table.options.meta as TimesheetTableMeta}
        row={row.original}
      />
    ),

    header: "Estado",
    id: "status",
    maxSize: 140,
    minSize: 110,
    size: 120,
  }),
  columnHelper.display({
    cell: ({ row, table }) => (
      <ActionsCell
        index={row.index}
        meta={table.options.meta as TimesheetTableMeta}
        row={row.original}
      />
    ),

    header: "Acciones",
    id: "actions",
    maxSize: 120,
    minSize: 80,
    size: 100,
  }),
];
