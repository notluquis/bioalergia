import { useMemo, useState } from "react";

import { DataTable } from "@/components/data-table/DataTable";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import { useAuth } from "@/context/AuthContext";
import type { Employee } from "@/features/hr/employees/types";

import type { BulkRow } from "../types";
import { formatDateLabel } from "../utils";
import { getTimesheetDetailColumns, TimesheetTableMeta } from "./TimesheetDetailColumns";

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

  const columns = useMemo(() => getTimesheetDetailColumns(), []);

  const meta: TimesheetTableMeta = useMemo(
    () => ({
      canEdit,
      initialRows,
      notWorkedDays,
      onRowChange,
      onSalidaBlur,
      onResetRow,
      onRemoveEntry,
      openOvertimeEditors,
      onOpenOvertime: (date) =>
        setOpenOvertimeEditors((prev) => {
          const next = new Set(prev);
          next.add(date);
          return next;
        }),
      onCloseOvertime: (date) =>
        setOpenOvertimeEditors((prev) => {
          const next = new Set(prev);
          next.delete(date);
          return next;
        }),
      setNotWorkedDays,
      setCommentPreview,
    }),
    [canEdit, initialRows, notWorkedDays, onRowChange, onSalidaBlur, onResetRow, onRemoveEntry, openOvertimeEditors]
  );

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

      <div className="muted-scrollbar border-base-200 transform-gpu overflow-x-auto rounded-lg border">
        <DataTable
          data={bulkRows}
          columns={columns}
          meta={meta}
          isLoading={loadingDetail}
          enableToolbar={false}
          enableVirtualization={false}
          noDataMessage={
            employeeOptions.length > 0
              ? "Selecciona un trabajador para ver o editar sus horas."
              : "Registra a trabajadores activos para comenzar a cargar horas."
          }
        />
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
