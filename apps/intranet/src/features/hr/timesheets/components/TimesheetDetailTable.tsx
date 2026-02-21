import type { ColumnDef } from "@tanstack/react-table";
import dayjs from "dayjs";
import { useState } from "react";
import { DataTable } from "@/components/data-table/DataTable";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { useAuth } from "@/context/AuthContext";
import type { Employee } from "@/features/hr/employees/types";

import type { BulkRow } from "../types";

import { formatDateLabel } from "../utils";
import { getTimesheetDetailColumns, type TimesheetTableMeta } from "./TimesheetDetailColumns";

interface TimesheetDetailTableProps {
  bulkRows: BulkRow[];
  employeeOptions: Employee[];
  initialRows: BulkRow[];
  loadingDetail: boolean;
  modifiedCount: number;
  monthLabel: string;
  onBulkSave: () => void;
  onRemoveEntry: (row: BulkRow) => void;
  onResetRow: (index: number) => void;
  onRowChange: (
    index: number,
    field: keyof Omit<BulkRow, "date" | "entryId">,
    value: string,
  ) => void;
  onSalidaBlur: (index: number) => void;
  pendingCount: number;
  saving: boolean;
  selectedEmployee: Employee | null;
}
export function TimesheetDetailTable({
  bulkRows,
  employeeOptions,
  initialRows,
  loadingDetail,
  modifiedCount,
  monthLabel,
  onBulkSave,
  onRemoveEntry,
  onResetRow,
  onRowChange,
  onSalidaBlur,
  pendingCount,
  saving,
  selectedEmployee,
}: TimesheetDetailTableProps) {
  const { can } = useAuth();
  const canEdit = can("update", "Timesheet");

  const [openOvertimeEditors, setOpenOvertimeEditors] = useState<Set<string>>(new Set());
  const [commentPreview, setCommentPreview] = useState<null | { date: Date; text: string }>(null);
  const [notWorkedDays, setNotWorkedDays] = useState<Set<string>>(new Set());

  const columns = getTimesheetDetailColumns();

  const meta: TimesheetTableMeta = {
    canEdit,
    initialRows,
    notWorkedDays,
    onCloseOvertime: (date) => {
      const dateKey = dayjs(date).format("YYYY-MM-DD");
      setOpenOvertimeEditors((prev) => {
        const next = new Set(prev);
        next.delete(dateKey);
        return next;
      });
    },
    onOpenOvertime: (date) => {
      const dateKey = dayjs(date).format("YYYY-MM-DD");
      setOpenOvertimeEditors((prev) => {
        const next = new Set(prev);
        next.add(dateKey);
        return next;
      });
    },
    onRemoveEntry,
    onResetRow,
    onRowChange,
    onSalidaBlur,
    openOvertimeEditors,
    setCommentPreview,
    setNotWorkedDays,
  };

  return (
    <div className="space-y-4 bg-background p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-default-600 text-sm">
          <span className="font-semibold">{monthLabel}</span>
          {selectedEmployee && (
            <span className="ml-2 text-default-500">· {selectedEmployee.full_name}</span>
          )}
        </div>
        {canEdit && (
          <div className="flex flex-wrap items-center gap-2">
            <Button
              disabled={saving || (pendingCount === 0 && modifiedCount === 0)}
              onClick={onBulkSave}
              variant="primary"
            >
              Guardar cambios
            </Button>
            <div className="text-default-500 text-xs sm:text-sm">
              {pendingCount > 0 && <span className="mr-2">Pendientes: {pendingCount}</span>}
              {modifiedCount > 0 && <span>Modificados: {modifiedCount}</span>}
            </div>
          </div>
        )}
      </div>

      <DataTable
        columns={columns as ColumnDef<BulkRow, unknown>[]}
        data={bulkRows}
        enablePagination={false}
        enableToolbar={false}
        enableVirtualization={false}
        isLoading={loadingDetail}
        meta={meta as unknown as Record<string, unknown>}
        noDataMessage={
          employeeOptions.length > 0
            ? "Selecciona un prestador para ver o editar sus tiempos."
            : "Registra prestadores activos para comenzar a cargar tiempos."
        }
        scrollMaxHeight="min(62dvh, 680px)"
      />

      {/* Modal para ver comentario */}
      <Modal
        isOpen={Boolean(commentPreview)}
        onClose={() => {
          setCommentPreview(null);
        }}
        title={`Comentario · ${commentPreview ? formatDateLabel(commentPreview.date) : ""}`}
      >
        <p className="whitespace-pre-wrap text-foreground">{commentPreview?.text}</p>
      </Modal>
    </div>
  );
}
