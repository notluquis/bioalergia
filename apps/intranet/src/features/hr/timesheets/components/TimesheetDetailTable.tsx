import { Button, Modal, Surface } from "@heroui/react";
import type { ColumnDef } from "@tanstack/react-table";
import dayjs from "dayjs";
import { useState, type ReactNode } from "react";
import { DataTable } from "@/components/data-table/DataTable";
import { useAuth } from "@/context/AuthContext";
import type { Employee } from "@/features/hr/employees/types";

import type { BulkRow } from "../types";

import { formatDateLabel } from "../utils";
import { getTimesheetDetailColumns, type TimesheetTableMeta } from "./TimesheetDetailColumns";

interface TimesheetDetailTableProps {
  bulkRows: BulkRow[];
  employeeOptions: Employee[];
  headerActions: ReactNode;
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
    value: string
  ) => void;
  onSalidaBlur: (index: number) => void;
  pendingCount: number;
  saving: boolean;
  selectedEmployee: Employee | null;
}
export function TimesheetDetailTable({
  bulkRows,
  employeeOptions,
  headerActions,
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

  const hasChanges = pendingCount > 0 || modifiedCount > 0;

  return (
    <Surface
      className="space-y-4 rounded-[28px] border border-default-200/70 p-4 sm:p-6"
      variant="secondary"
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-2">
          <div className="text-default-700 text-sm">
            <span className="font-semibold">{monthLabel}</span>
            {selectedEmployee && (
              <span className="ml-2 text-default-500">· {selectedEmployee.full_name}</span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm">
            <span className="rounded-full border border-default-200/80 bg-background px-3 py-1 text-default-500">
              Pendientes: {pendingCount}
            </span>
            <span className="rounded-full border border-default-200/80 bg-background px-3 py-1 text-default-500">
              Modificados: {modifiedCount}
            </span>
          </div>
        </div>

        <div className="flex flex-col items-stretch gap-3 sm:items-end">
          <div className="flex flex-wrap items-center justify-start gap-2 sm:justify-end">
            {headerActions}
            {canEdit && (
              <Button
                isDisabled={saving || !hasChanges}
                isPending={saving}
                onPress={onBulkSave}
                variant="primary"
              >
                Guardar cambios
              </Button>
            )}
          </div>
        </div>
      </div>

      <DataTable
        columns={columns as ColumnDef<BulkRow, unknown>[]}
        data={bulkRows}
        enablePagination={false}
        enableToolbar={false}
        enableVirtualization={false}
        isLoading={loadingDetail}
        meta={meta}
        noDataMessage={
          employeeOptions.length > 0
            ? "Selecciona un prestador para ver o editar sus tiempos."
            : "Registra prestadores activos para comenzar a cargar tiempos."
        }
        scrollMaxHeight="min(62dvh, 680px)"
      />

      {/* Modal para ver comentario */}
      <Modal>
        <Modal.Backdrop
          className="bg-black/40 backdrop-blur-[2px]"
          isOpen={Boolean(commentPreview)}
          onOpenChange={(open) => {
            if (!open) {
              setCommentPreview(null);
            }
          }}
        >
          <Modal.Container placement="center">
            <Modal.Dialog className="relative w-full max-w-2xl rounded-[28px] bg-background p-6 shadow-2xl">
              <Modal.Header className="mb-4 font-bold text-primary text-xl">
                <Modal.Heading>{`Comentario · ${commentPreview ? formatDateLabel(commentPreview.date) : ""}`}</Modal.Heading>
              </Modal.Header>
              <Modal.Body className="mt-2 max-h-[80vh] overflow-y-auto overscroll-contain text-foreground">
                <p className="whitespace-pre-wrap text-foreground">{commentPreview?.text}</p>
              </Modal.Body>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>
    </Surface>
  );
}
