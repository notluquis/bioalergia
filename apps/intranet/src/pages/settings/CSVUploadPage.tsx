import { Card, Chip, Label, ListBox, Select, Tooltip } from "@heroui/react";
import { useMutation } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { AlertCircle, CheckCircle, FileUp, Loader2, Lock } from "lucide-react";
import Papa from "papaparse";
import { useState } from "react";

import { DataTable } from "@/components/data-table/DataTable";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { FileInput } from "@/components/ui/FileInput";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import type { AuthContextType } from "@/features/auth/hooks/use-auth";
import {
  type CsvImportPayload,
  type CsvPreviewResponse,
  importCsvData,
  previewCsvImport,
} from "@/features/data-import/api";
import { FileListItem, type FileStatus } from "@/features/data-import/FileListItem";
import { getSIIMappingsForTable, matchSIIHeader } from "@/features/data-import/sii-mappings";
import { cn } from "@/lib/utils";

// Types
interface TableOption {
  fields: { name: string; required: boolean; type: string }[];
  label: string;
  value: string;
}

interface FieldDefinition {
  name: string;
  required: boolean;
  type: string;
}

interface UploadedFile {
  columnMapping: Record<string, string>;
  csvData: Record<string, string>[];
  csvHeaders: string[];
  error?: string;
  file: File;
  id: string;
  previewData?: CsvPreviewResponse;
  rowCount: number;
  status: FileStatus;
}

const HEADER_ALIAS_REGEX = /\(([^)]+)\)/;
const normalizeKey = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, "");

const extractHeaderAliases = (header: string) => {
  const aliases = [header];
  const match = header.match(HEADER_ALIAS_REGEX);
  if (match?.[1]) {
    aliases.push(match[1]);
  }
  return aliases;
};

const getAllowedTableOptions = (can: AuthContextType["can"]) =>
  TABLE_OPTIONS.filter((table) => {
    if (!SUPPORTED_TABLES.has(table.value)) {
      return false;
    }
    const perm = PERMISSION_MAP[table.value];
    if (!perm) {
      return false;
    }
    return can(perm.action, perm.subject);
  });

const buildTransformedData = (
  csvData: Record<string, string>[],
  columnMapping: Record<string, string>,
): Record<string, string | number>[] =>
  csvData.map((row) => {
    const transformed: Record<string, number | string> = {};
    for (const [dbField, csvColumn] of Object.entries(columnMapping)) {
      if (!csvColumn || row[csvColumn] === undefined) {
        continue;
      }
      const value = row[csvColumn];
      const trimmed = typeof value === "string" ? value.trim() : "";
      // Include non-empty strings and all non-string values
      if (trimmed.length > 0) {
        transformed[dbField] = trimmed;
      } else if (typeof value !== "string") {
        transformed[dbField] = value;
      }
    }
    return transformed;
  });

const normalizeWithdrawIdForBatch = (value: unknown) => String(value ?? "").trim();

function buildBatchRows(
  selectedTable: string,
  files: UploadedFile[],
): { droppedDuplicates: number; rows: Record<string, number | string>[] } {
  const allRows = files
    .filter((file) => file.status !== "error")
    .flatMap((file) => buildTransformedData(file.csvData, file.columnMapping));

  if (selectedTable !== "withdrawals") {
    return { droppedDuplicates: 0, rows: allRows };
  }

  const seen = new Set<string>();
  const deduped: Record<string, number | string>[] = [];
  let droppedDuplicates = 0;

  for (const row of allRows) {
    const key = normalizeWithdrawIdForBatch(row.withdrawId);
    if (!key) {
      deduped.push(row);
      continue;
    }
    if (seen.has(key)) {
      droppedDuplicates += 1;
      continue;
    }
    seen.add(key);
    deduped.push(row);
  }

  return { droppedDuplicates, rows: deduped };
}

const isValidColumnMapping = (
  table: TableOption | undefined,
  columnMapping: Record<string, string>,
): boolean => {
  if (!table) {
    return false;
  }
  const requiredFields = table.fields.filter((field) => field.required);
  return requiredFields.every(
    (field) => columnMapping[field.name] && columnMapping[field.name] !== "",
  );
};

const matchHeaderForField = (fieldName: string, headers: string[]) => {
  const normalizedField = normalizeKey(fieldName);
  for (const header of headers) {
    const aliases = extractHeaderAliases(header);
    if (aliases.some((alias) => normalizeKey(alias) === normalizedField)) {
      return header;
    }
  }
  return undefined;
};

const mapFieldsUsingExistingLogic = (
  headers: string[],
  fields: FieldDefinition[],
): Record<string, string> => {
  const mapping: Record<string, string> = {};
  for (const field of fields) {
    const matched = matchHeaderForField(field.name, headers);
    if (matched) {
      mapping[field.name] = matched;
    }
  }
  return mapping;
};

const mapFieldsUsingSII = (
  headers: string[],
  fields: FieldDefinition[],
  siiMappings: Record<string, string>,
  existingMapping: Record<string, string>,
): Record<string, string> => {
  const mapping = { ...existingMapping };
  for (const field of fields) {
    if (!mapping[field.name]) {
      for (const header of headers) {
        const dbField = matchSIIHeader(header, siiMappings);
        if (dbField === field.name) {
          mapping[field.name] = header;
          break;
        }
      }
    }
  }
  return mapping;
};

const autoMapColumns = (
  headers: string[],
  tableFields: FieldDefinition[],
  tableValue: string,
): Record<string, string> => {
  // First try existing header matching logic
  let mapping = mapFieldsUsingExistingLogic(headers, tableFields);

  // Then try SII standard mappings if available
  const siiMappings = getSIIMappingsForTable(tableValue);
  if (siiMappings) {
    mapping = mapFieldsUsingSII(headers, tableFields, siiMappings, mapping);
  }

  return mapping;
};

// Constants
const TABLE_OPTIONS: TableOption[] = [
  {
    fields: [
      { name: "rut", required: true, type: "string" },
      { name: "names", required: true, type: "string" },
      { name: "fatherName", required: false, type: "string" },
      { name: "motherName", required: false, type: "string" },
      { name: "email", required: false, type: "string" },
      { name: "phone", required: false, type: "string" },
      { name: "address", required: false, type: "string" },
      { name: "personType", required: false, type: "enum" },
    ],

    label: "Personas",
    value: "people",
  },
  {
    fields: [
      { name: "rut", required: true, type: "string" },
      { name: "position", required: true, type: "string" },
      { name: "department", required: false, type: "string" },
      { name: "startDate", required: true, type: "date" },
      { name: "endDate", required: false, type: "date" },
      { name: "status", required: false, type: "enum" },
      { name: "salaryType", required: false, type: "enum" },
      { name: "baseSalary", required: false, type: "number" },
      { name: "hourlyRate", required: false, type: "number" },
      { name: "overtimeRate", required: false, type: "number" },
      { name: "retentionRate", required: false, type: "number" },
      { name: "bankName", required: false, type: "string" },
      { name: "bankAccountType", required: false, type: "string" },
      { name: "bankAccountNumber", required: false, type: "string" },
    ],

    label: "Trabajadores",
    value: "employees",
  },
  {
    fields: [
      { name: "rut", required: true, type: "string" },
      { name: "category", required: false, type: "enum" },
      { name: "notes", required: false, type: "string" },
    ],

    label: "Contrapartes",
    value: "counterparts",
  },
  {
    fields: [
      { name: "timestamp", required: true, type: "datetime" },
      { name: "description", required: false, type: "string" },
      { name: "amount", required: true, type: "number" },
      { name: "direction", required: true, type: "enum" },
      { name: "rut", required: false, type: "string" },
      { name: "origin", required: false, type: "string" },
      { name: "destination", required: false, type: "string" },
      { name: "category", required: false, type: "string" },
    ],

    label: "Transacciones",
    value: "transactions",
  },
  {
    fields: [
      { name: "date", required: true, type: "date" },
      { name: "amount", required: true, type: "number" },
      { name: "note", required: false, type: "string" },
    ],

    label: "Saldos diarios",
    value: "daily_balances",
  },
  {
    fields: [
      { name: "balanceDate", required: true, type: "date" },
      { name: "ingresoTarjetas", required: false, type: "number" },
      { name: "ingresoTransferencias", required: false, type: "number" },
      { name: "ingresoEfectivo", required: false, type: "number" },
      { name: "gastosDiarios", required: false, type: "number" },
      { name: "otrosAbonos", required: false, type: "number" },
      { name: "consultasMonto", required: false, type: "number" },
      { name: "controlesMonto", required: false, type: "number" },
      { name: "testsMonto", required: false, type: "number" },
      { name: "vacunasMonto", required: false, type: "number" },
      { name: "licenciasMonto", required: false, type: "number" },
      { name: "roxairMonto", required: false, type: "number" },
      { name: "comentarios", required: false, type: "string" },
      { name: "status", required: false, type: "enum" },
      { name: "changeReason", required: false, type: "string" },
    ],

    label: "Saldos Producción",
    value: "daily_production_balances",
  },
  {
    fields: [
      { name: "dateCreated", required: true, type: "date" },
      { name: "withdrawId", required: true, type: "string" },
      { name: "status", required: false, type: "string" },
      { name: "statusDetail", required: false, type: "string" },
      { name: "amount", required: false, type: "number" },
      { name: "fee", required: false, type: "number" },
      { name: "activityUrl", required: false, type: "string" },
      { name: "payoutDescription", required: false, type: "string" },
      { name: "bankAccountHolder", required: false, type: "string" },
      { name: "identificationType", required: false, type: "string" },
      { name: "identificationNumber", required: false, type: "string" },
      { name: "bankId", required: false, type: "string" },
      { name: "bankName", required: false, type: "string" },
      { name: "bankBranch", required: false, type: "string" },
      { name: "bankAccountType", required: false, type: "string" },
      { name: "bankAccountNumber", required: false, type: "string" },
    ],

    label: "Retiros (MercadoPago)",
    value: "withdrawals",
  },
  {
    fields: [
      { name: "name", required: true, type: "string" },
      { name: "description", required: false, type: "string" },
      { name: "frequency", required: true, type: "enum" },
      { name: "serviceType", required: true, type: "enum" },
      { name: "defaultAmount", required: true, type: "number" },
    ],

    label: "Servicios Recurrentes",
    value: "services",
  },
  {
    fields: [
      { name: "sku", required: true, type: "string" },
      { name: "name", required: true, type: "string" },
      { name: "description", required: false, type: "string" },
      { name: "category", required: false, type: "string" },
      { name: "unit", required: true, type: "string" },
      { name: "minStock", required: false, type: "number" },
      { name: "currentStock", required: false, type: "number" },
      { name: "price", required: false, type: "number" },
    ],

    label: "Inventario",
    value: "inventory_items",
  },
  {
    fields: [
      { name: "rut", required: true, type: "string" },
      { name: "workDate", required: true, type: "date" },
      { name: "startTime", required: false, type: "string" },
      { name: "endTime", required: false, type: "string" },
      { name: "workedMinutes", required: false, type: "number" },
      { name: "overtimeMinutes", required: false, type: "number" },
      { name: "comment", required: false, type: "string" },
    ],

    label: "Horas Trabajadas (Diarios)",
    value: "employee_timesheets",
  },
  {
    fields: [
      { name: "period", required: false, type: "string" },
      { name: "documentDate", required: true, type: "date" },
      { name: "receiptDate", required: true, type: "date" },
      { name: "providerRUT", required: true, type: "string" },
      { name: "providerName", required: true, type: "string" },
      { name: "folio", required: true, type: "string" },
      { name: "documentType", required: false, type: "number" },
      { name: "purchaseType", required: true, type: "string" },
      { name: "registerNumber", required: true, type: "number" },
      { name: "exemptAmount", required: false, type: "number" },
      { name: "netAmount", required: true, type: "number" },
      { name: "recoverableIVA", required: false, type: "number" },
      { name: "nonRecoverableIVA", required: false, type: "number" },
      { name: "nonRecoverableIVACode", required: false, type: "string" },
      { name: "totalAmount", required: true, type: "number" },
      { name: "fixedAssetNetAmount", required: false, type: "number" },
      { name: "commonUseIVA", required: false, type: "number" },
      { name: "nonCreditableTax", required: false, type: "number" },
      { name: "nonRetainedIVA", required: false, type: "number" },
      { name: "otherTaxCode", required: false, type: "string" },
      { name: "otherTaxAmount", required: false, type: "number" },
      { name: "otherTaxRate", required: false, type: "number" },
      { name: "acknowledgeDate", required: false, type: "date" },
      { name: "referenceDocNote", required: false, type: "string" },
      { name: "notes", required: false, type: "string" },
    ],

    label: "DTE Compras (Tipo 33)",
    value: "dte_purchases",
  },
  {
    fields: [
      { name: "period", required: false, type: "string" },
      { name: "documentDate", required: true, type: "date" },
      { name: "receiptDate", required: true, type: "date" },
      { name: "clientRUT", required: true, type: "string" },
      { name: "clientName", required: true, type: "string" },
      { name: "folio", required: true, type: "string" },
      { name: "documentType", required: true, type: "number" },
      { name: "saleType", required: true, type: "string" },
      { name: "registerNumber", required: true, type: "number" },
      { name: "exemptAmount", required: false, type: "number" },
      { name: "netAmount", required: true, type: "number" },
      { name: "ivaAmount", required: false, type: "number" },
      { name: "totalAmount", required: true, type: "number" },
      { name: "totalRetainedIVA", required: false, type: "number" },
      { name: "partialRetainedIVA", required: false, type: "number" },
      { name: "nonRetainedIVA", required: false, type: "number" },
      { name: "ownIVA", required: false, type: "number" },
      { name: "thirdPartyIVA", required: false, type: "number" },
      { name: "lateIVA", required: false, type: "number" },
      { name: "emitterRUT", required: false, type: "string" },
      { name: "commissionNetAmount", required: false, type: "number" },
      { name: "commissionExemptAmount", required: false, type: "number" },
      { name: "commissionIVA", required: false, type: "number" },
      { name: "referenceDocType", required: false, type: "string" },
      { name: "referenceDocFolio", required: false, type: "string" },
      { name: "foreignBuyerIdentifier", required: false, type: "string" },
      { name: "foreignBuyerNationality", required: false, type: "string" },
      { name: "constructorCreditAmount", required: false, type: "number" },
      { name: "freeTradeZoneAmount", required: false, type: "number" },
      { name: "containerGuaranteeAmount", required: false, type: "number" },
      { name: "nonBillableAmount", required: false, type: "number" },
      { name: "internationalTransportAmount", required: false, type: "number" },
      { name: "nationalTransportPassageAmount", required: false, type: "number" },
      { name: "nonCostSaleIndicator", required: false, type: "number" },
      { name: "periodicServiceIndicator", required: false, type: "number" },
      { name: "totalPeriodAmount", required: false, type: "number" },
      { name: "internalNumber", required: false, type: "number" },
      { name: "branchCode", required: false, type: "string" },
      { name: "origin", required: false, type: "string" },
      { name: "informativeNote", required: false, type: "string" },
      { name: "paymentNote", required: false, type: "string" },
      { name: "notes", required: false, type: "string" },
      { name: "receiptAcknowledgeDate", required: false, type: "date" },
      { name: "claimDate", required: false, type: "date" },
    ],

    label: "DTE Ventas (Tipos 41/61)",
    value: "dte_sales",
  },
];

const SUPPORTED_TABLES = new Set([
  "counterparts",
  "daily_balances",
  "daily_production_balances",
  "dte_purchases",
  "dte_sales",
  "employee_timesheets",
  "employees",
  "inventory_items",
  "people",
  "services",
  "transactions",
  "withdrawals",
]);

const PERMISSION_MAP: Record<string, { action: string; subject: string }> = {
  counterparts: { action: "create", subject: "Counterpart" },
  daily_balances: { action: "create", subject: "DailyBalance" },
  daily_production_balances: { action: "create", subject: "ProductionBalance" },
  dte_purchases: { action: "create", subject: "DTEPurchaseDetail" },
  dte_sales: { action: "create", subject: "DTESaleDetail" },
  employee_timesheets: { action: "create", subject: "Timesheet" },
  employees: { action: "create", subject: "Employee" },
  inventory_items: { action: "create", subject: "InventoryItem" },
  people: { action: "create", subject: "Person" },
  services: { action: "create", subject: "Service" },
  transactions: { action: "create", subject: "Transaction" },
  withdrawals: { action: "create", subject: "WithdrawTransaction" },
};

// --- Sub-Components ---

function AccessDeniedAlert() {
  return (
    <Alert status="warning">
      <Lock className="h-4 w-4" />
      <div className="flex flex-col">
        <span className="font-bold">Acceso restringido</span>
        <span>No tienes permisos para importar datos en ninguna tabla disponible.</span>
      </div>
    </Alert>
  );
}

function TableSelectionCard({
  allowedTableOptions,
  currentTable,
  onTableChange,
  selectedTable,
}: {
  allowedTableOptions: TableOption[];
  currentTable?: TableOption;
  onTableChange: (val: string) => void;
  selectedTable: string;
}) {
  const NO_TABLE_SELECTED_KEY = "__no_table_selected__";

  return (
    <Card>
      <Card.Header>
        <Card.Title className="flex items-center gap-2">
          <FileUp className="h-5 w-5 text-primary" />
          1. Seleccionar destino
        </Card.Title>
        <Card.Description>Elige la tabla donde deseas importar los datos.</Card.Description>
      </Card.Header>
      <Card.Content>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
          <div className="w-full sm:w-1/3">
            <Select
              className="w-full max-w-md"
              onChange={(val) =>
                onTableChange(val === NO_TABLE_SELECTED_KEY ? "" : (val as string))
              }
              value={selectedTable || NO_TABLE_SELECTED_KEY}
            >
              <Label>Tipo de Datos (Tabla)</Label>
              <Select.Trigger>
                <Select.Value />
                <Select.Indicator />
              </Select.Trigger>
              <Select.Popover>
                <ListBox>
                  <ListBox.Item id={NO_TABLE_SELECTED_KEY} key={NO_TABLE_SELECTED_KEY}>
                    -- Seleccionar tabla --
                  </ListBox.Item>
                  {allowedTableOptions.map((table) => (
                    <ListBox.Item id={table.value} key={table.value}>
                      {table.label}
                    </ListBox.Item>
                  ))}
                </ListBox>
              </Select.Popover>
            </Select>
          </div>

          {currentTable && (
            <div className="flex-1 rounded-lg bg-default-50/50 p-4">
              <span className="mb-2 block font-bold text-xs uppercase tracking-wide opacity-70">
                Campos requeridos
              </span>
              <div className="flex flex-wrap gap-2">
                {currentTable.fields.map((field) => (
                  <Chip
                    className={cn("opacity-100", !field.required && "opacity-60")}
                    color={field.required ? "accent" : "default"}
                    key={field.name}
                    size="sm"
                    variant={field.required ? "primary" : "secondary"}
                  >
                    {field.name}
                    {field.required && "*"}
                  </Chip>
                ))}
              </div>
            </div>
          )}
        </div>
      </Card.Content>
    </Card>
  );
}

function ColumnMappingCard({
  columns,
  fields,
  totalRows,
}: {
  columns: ColumnDef<FieldDefinition>[];
  fields: FieldDefinition[];
  totalRows: number;
}) {
  return (
    <Card>
      <Card.Header>
        <Card.Title>Mapeo de columnas</Card.Title>
        <Card.Description>
          Relaciona las columnas de tu CSV con los campos de la base de datos.
          <br />
          <span className="text-xs opacity-70">Total de filas: {totalRows}</span>
        </Card.Description>
      </Card.Header>
      <div className="border-t">
        <DataTable
          columns={columns}
          data={fields}
          containerVariant="plain"
          enablePagination={false}
          enableToolbar={false}
          scrollMaxHeight="min(56dvh, 640px)"
        />
      </div>
    </Card>
  );
}

function FileUploadSection({
  disabled,
  onFileChange,
  selectedTable,
}: {
  disabled: boolean;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  selectedTable: string;
}) {
  if (!selectedTable) {
    return null;
  }

  return (
    <Card>
      <Card.Header>
        <Card.Title>Cargar archivos</Card.Title>
        <Card.Description>
          Arrastra uno o más archivos CSV aquí o haz clic para seleccionar
        </Card.Description>
      </Card.Header>
      <Card.Content>
        <FileInput accept=".csv" disabled={disabled} multiple onChange={onFileChange} />
      </Card.Content>
    </Card>
  );
}

function FilesListSection({
  onRemove,
  uploadedFiles,
}: {
  onRemove: (id: string) => void;
  uploadedFiles: UploadedFile[];
}) {
  if (uploadedFiles.length === 0) {
    return null;
  }

  const totalRows = uploadedFiles.reduce((sum, f) => sum + f.rowCount, 0);
  const successCount = uploadedFiles.filter((f) => f.status === "success").length;
  const errorCount = uploadedFiles.filter((f) => f.status === "error").length;

  return (
    <Card>
      <Card.Header>
        <div className="flex items-center justify-between">
          <div>
            <Card.Title>Archivos cargados</Card.Title>
            <Card.Description>
              {uploadedFiles.length} archivo{uploadedFiles.length !== 1 ? "s" : ""} · {totalRows}{" "}
              filas totales
            </Card.Description>
          </div>
          {(successCount > 0 || errorCount > 0) && (
            <div className="flex gap-2 text-sm">
              {successCount > 0 && (
                <Chip color="success" size="sm" variant="soft">
                  <Chip.Label>
                    {successCount} exitoso{successCount !== 1 ? "s" : ""}
                  </Chip.Label>
                </Chip>
              )}
              {errorCount > 0 && (
                <Chip color="danger" size="sm" variant="soft">
                  <Chip.Label>
                    {errorCount} con error{errorCount !== 1 ? "es" : ""}
                  </Chip.Label>
                </Chip>
              )}
            </div>
          )}
        </div>
      </Card.Header>
      <Card.Content className="space-y-2">
        {uploadedFiles.map((uploadedFile) => (
          <FileListItem
            key={uploadedFile.id}
            file={uploadedFile.file}
            id={uploadedFile.id}
            onRemove={onRemove}
            rowCount={uploadedFile.rowCount}
            status={uploadedFile.status}
            statusMessage={uploadedFile.error}
          />
        ))}
      </Card.Content>
    </Card>
  );
}

function ImportSummaryCard({
  droppedDuplicates,
  previewData,
}: {
  droppedDuplicates: number;
  previewData: CsvPreviewResponse | null;
}) {
  if (!previewData) {
    return null;
  }

  return (
    <Card className="border-primary/20 bg-primary/5">
      <Card.Content className="p-6">
        <span className="mb-4 block font-semibold text-lg">Vista Previa de Importación</span>
        {droppedDuplicates > 0 && (
          <div className="mb-3 rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-warning text-xs">
            Se detectaron {droppedDuplicates} filas repetidas por <code>withdrawId</code> entre
            archivos y se omitieron del cálculo del lote.
          </div>
        )}
        <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-3">
          <div className="rounded-lg border border-default-100 bg-background p-3 shadow-sm">
            <div className="mb-1 text-xs uppercase tracking-wider opacity-70">Insertar</div>
            <div className="font-bold text-2xl text-success">{previewData.toInsert ?? 0}</div>
          </div>
          <div className="rounded-lg border border-default-100 bg-background p-3 shadow-sm">
            <div className="mb-1 text-xs uppercase tracking-wider opacity-70">Actualizar</div>
            <div className="font-bold text-2xl text-info">{previewData.toUpdate ?? 0}</div>
          </div>
          <div className="rounded-lg border border-default-100 bg-background p-3 shadow-sm">
            <div className="mb-1 text-xs uppercase tracking-wider opacity-70">Omitir</div>
            <div className="font-bold text-2xl text-warning">{previewData.toSkip ?? 0}</div>
          </div>
        </div>

        {(previewData.errors?.length ?? 0) > 0 && (
          <Alert className="mb-0" status="warning">
            <div className="flex w-full flex-col gap-2">
              <div className="flex items-center gap-2 font-medium">
                <AlertCircle className="h-4 w-4" />
                Errores de validación ({previewData.errors?.length ?? 0})
              </div>
              <ul className="max-h-32 list-inside list-disc overflow-y-auto rounded bg-background/50 p-2 text-xs opacity-90">
                {(previewData.errors ?? []).slice(0, 50).map((err: string, i: number) => (
                  <li key={`${i}-${err.substring(0, 20)}`}>{err}</li>
                ))}
                {(previewData.errors?.length ?? 0) > 50 && (
                  <li className="text-default-500">
                    ...y {(previewData.errors?.length ?? 0) - 50} más
                  </li>
                )}
              </ul>
            </div>
          </Alert>
        )}
      </Card.Content>
    </Card>
  );
}

function ImportModeCard({
  importMode,
  onModeChange,
}: {
  importMode: "insert-only" | "insert-or-update";
  onModeChange: (mode: "insert-only" | "insert-or-update") => void;
}) {
  return (
    <Card>
      <Card.Header>
        <Card.Title className="flex items-center gap-2">
          <CheckCircle className="h-5 w-5 text-primary" />
          Modo de importación
        </Card.Title>
        <Card.Description>
          Elige cómo deseas procesar los datos: solo nuevos o actualizar existentes
        </Card.Description>
      </Card.Header>
      <Card.Content>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Button
            className={cn(
              "flex-1 rounded-lg border-2 p-4 text-left transition-colors",
              importMode === "insert-only"
                ? "border-primary/50 bg-primary/5"
                : "border-default-200 hover:border-default-300",
            )}
            onPress={() => onModeChange("insert-only")}
            type="button"
            variant="ghost"
          >
            <div className="flex items-center gap-3">
              <Chip
                className="min-w-24 justify-center text-center"
                color={importMode === "insert-only" ? "accent" : "default"}
                size="sm"
                variant={importMode === "insert-only" ? "primary" : "tertiary"}
              >
                {importMode === "insert-only" ? "Seleccionado" : "Elegir"}
              </Chip>
              <div className="flex-1">
                <div className="font-semibold text-sm">Solo importar nuevos</div>
                <div className="text-xs opacity-60">
                  Inserta solo registros nuevos. Los existentes se omiten.
                </div>
              </div>
            </div>
          </Button>

          <Button
            className={cn(
              "flex-1 rounded-lg border-2 p-4 text-left transition-colors",
              importMode === "insert-or-update"
                ? "border-primary/50 bg-primary/5"
                : "border-default-200 hover:border-default-300",
            )}
            onPress={() => onModeChange("insert-or-update")}
            type="button"
            variant="ghost"
          >
            <div className="flex items-center gap-3">
              <Chip
                className="min-w-24 justify-center text-center"
                color={importMode === "insert-or-update" ? "accent" : "default"}
                size="sm"
                variant={importMode === "insert-or-update" ? "primary" : "tertiary"}
              >
                {importMode === "insert-or-update" ? "Seleccionado" : "Elegir"}
              </Chip>
              <div className="flex-1">
                <div className="font-semibold text-sm">Insertar o actualizar</div>
                <div className="text-xs opacity-60">
                  Inserta registros nuevos y actualiza los existentes.
                </div>
              </div>
            </div>
          </Button>
        </div>
      </Card.Content>
    </Card>
  );
}

function buildMappingColumns({
  firstFile,
  onMappingChanged,
  setUploadedFiles,
}: {
  firstFile: UploadedFile | undefined;
  onMappingChanged: () => void;
  setUploadedFiles: React.Dispatch<React.SetStateAction<UploadedFile[]>>;
}): ColumnDef<FieldDefinition>[] {
  const UNMAPPED_COLUMN_KEY = "__unmapped_column__";

  if (!firstFile) {
    return [];
  }

  return [
    {
      accessorKey: "name",
      cell: ({ row }) => (
        <div className="flex items-center gap-1.5 font-medium">
          {row.original.name}
          {row.original.required && (
            <Tooltip>
              <Tooltip.Trigger>
                <span className="text-danger text-xs">*</span>
              </Tooltip.Trigger>
              <Tooltip.Content>Requerido</Tooltip.Content>
            </Tooltip>
          )}
        </div>
      ),

      header: "Campo BD",
    },
    {
      accessorKey: "type",
      cell: ({ row }) => (
        <Chip className="font-mono" size="sm" variant="secondary">
          {row.original.type}
        </Chip>
      ),

      header: "Tipo",
    },
    {
      cell: ({ row }) => (
        <Select
          className="w-full min-w-35"
          onChange={(val) => {
            onMappingChanged();
            setUploadedFiles((prev) =>
              prev.map((file, idx) => {
                if (idx === 0) {
                  // Update first file's mapping
                  return {
                    ...file,
                    columnMapping: {
                      ...file.columnMapping,
                      [row.original.name]: val === UNMAPPED_COLUMN_KEY ? "" : (val as string),
                    },
                  };
                }
                return file;
              }),
            );
          }}
          value={firstFile.columnMapping[row.original.name] || UNMAPPED_COLUMN_KEY}
        >
          <Label>Columna CSV</Label>
          <Select.Trigger>
            <Select.Value />
            <Select.Indicator />
          </Select.Trigger>
          <Select.Popover>
            <ListBox>
              <ListBox.Item id={UNMAPPED_COLUMN_KEY} key={UNMAPPED_COLUMN_KEY}>
                -- Ignorar / Sin mapear --
              </ListBox.Item>
              {firstFile.csvHeaders.map((header) => (
                <ListBox.Item id={header} key={header}>
                  {header}
                </ListBox.Item>
              ))}
            </ListBox>
          </Select.Popover>
        </Select>
      ),

      header: "Columna CSV",
      id: "mapping",
    },
    {
      cell: ({ row }) => {
        const mappedColumn = firstFile.columnMapping[row.original.name];
        return (
          <span className="max-w-37.5 truncate font-mono text-default-500 text-xs">
            {(mappedColumn && firstFile.csvData[0]?.[mappedColumn]) ?? "-"}
          </span>
        );
      },
      header: "Ejemplo (Fila 1)",
      id: "preview",
    },
  ];
}

// --- Main Page Component ---

// Helper to parse a single file
async function parseFile(
  file: File,
  currentTable: TableOption | undefined,
  selectedTable: string,
): Promise<UploadedFile> {
  try {
    const results = await new Promise<Papa.ParseResult<Record<string, string>>>(
      (resolve, reject) => {
        Papa.parse<Record<string, string>>(file, {
          complete: resolve,
          delimitersToGuess: [",", ";", "\t", "|"],
          error: reject,
          header: true,
          skipEmptyLines: true,
        });
      },
    );

    if (results.errors.length > 0) {
      return {
        columnMapping: {},
        csvData: [],
        csvHeaders: [],
        error: results.errors[0]?.message ?? "Error desconocido",
        file,
        id: crypto.randomUUID(),
        rowCount: 0,
        status: "error",
      };
    }

    const headers = (results.meta.fields ?? []) as string[];
    const csvData = results.data;

    // Auto-map columns
    let columnMapping: Record<string, string> = {};
    if (currentTable) {
      columnMapping = autoMapColumns(headers, currentTable.fields, selectedTable);
    }

    return {
      columnMapping,
      csvData,
      csvHeaders: headers,
      file,
      id: crypto.randomUUID(),
      rowCount: csvData.length,
      status: "ready",
    };
  } catch (error) {
    return {
      columnMapping: {},
      csvData: [],
      csvHeaders: [],
      error: error instanceof Error ? error.message : "Error al parsear archivo",
      file,
      id: crypto.randomUUID(),
      rowCount: 0,
      status: "error",
    };
  }
}

// Golden standard 2026: Helper to process file import with validation error detection
// Separated from component to reduce complexity
export function CSVUploadPage() {
  const { can } = useAuth();
  const { error: toastError, success } = useToast();

  // State
  const [selectedTable, setSelectedTable] = useState<string>("");
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [batchDroppedDuplicates, setBatchDroppedDuplicates] = useState(0);
  const [batchPreviewData, setBatchPreviewData] = useState<CsvPreviewResponse | null>(null);
  const [importMode, setImportMode] = useState<"insert-only" | "insert-or-update">(
    "insert-or-update",
  );

  const allowedTableOptions = getAllowedTableOptions(can);
  const currentTable = allowedTableOptions.find((t) => t.value === selectedTable);
  const firstFile = uploadedFiles[0];

  // Mutations
  const { mutateAsync: previewMutateAsync } = useMutation({
    mutationFn: (payload: CsvImportPayload) => previewCsvImport(payload),
  });

  const { mutateAsync: importMutateAsync } = useMutation({
    mutationFn: (payload: CsvImportPayload) => importCsvData(payload),
  });

  // Handlers
  const resetState = () => {
    setUploadedFiles([]);
    setBatchDroppedDuplicates(0);
    setBatchPreviewData(null);
  };

  const handleTableChange = (value: string) => {
    setSelectedTable(value);
    resetState();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) {
      return;
    }

    // Parse all files in parallel
    const parsePromises = files.map((file) => parseFile(file, currentTable, selectedTable));
    const newFiles = await Promise.all(parsePromises);

    setBatchDroppedDuplicates(0);
    setBatchPreviewData(null);
    setUploadedFiles((prev) => [...prev, ...newFiles]);
    e.target.value = "";
  };

  const handleRemoveFile = (id: string) => {
    setUploadedFiles((prev) => prev.filter((f) => f.id !== id));
    setBatchDroppedDuplicates(0);
    setBatchPreviewData(null);
  };

  const handlePreview = async () => {
    if (!selectedTable || uploadedFiles.length === 0) {
      return;
    }

    setIsProcessing(true);
    setUploadedFiles((prev) =>
      prev.map((f) => (f.status === "error" ? f : { ...f, status: "previewing" as FileStatus })),
    );

    try {
      const batch = buildBatchRows(selectedTable, uploadedFiles);
      const previewData = await previewMutateAsync({
        data: batch.rows,
        table: selectedTable,
        mode: importMode,
      });

      setBatchDroppedDuplicates(batch.droppedDuplicates);
      setBatchPreviewData(previewData);
      setUploadedFiles((prev) =>
        prev.map((f) => (f.status === "error" ? f : { ...f, status: "ready" as FileStatus })),
      );
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Error en vista previa";
      toastError(errorMsg);
      setUploadedFiles((prev) =>
        prev.map((f) => (f.status === "error" ? f : { ...f, status: "error" as FileStatus })),
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const handleImportModeChange = (mode: "insert-only" | "insert-or-update") => {
    if (mode === importMode) {
      return;
    }
    setImportMode(mode);
    if (!selectedTable || uploadedFiles.length === 0) {
      return;
    }
    void (async () => {
      setIsProcessing(true);
      setUploadedFiles((prev) =>
        prev.map((f) => (f.status === "error" ? f : { ...f, status: "previewing" as FileStatus })),
      );

      try {
        const batch = buildBatchRows(selectedTable, uploadedFiles);
        const previewData = await previewMutateAsync({
          data: batch.rows,
          table: selectedTable,
          mode,
        });

        setBatchDroppedDuplicates(batch.droppedDuplicates);
        setBatchPreviewData(previewData);
        setUploadedFiles((prev) =>
          prev.map((f) => (f.status === "error" ? f : { ...f, status: "ready" as FileStatus })),
        );
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : "Error en vista previa";
        toastError(errorMsg);
        setUploadedFiles((prev) =>
          prev.map((f) => (f.status === "error" ? f : { ...f, status: "error" as FileStatus })),
        );
      } finally {
        setIsProcessing(false);
      }
    })();
  };

  const handleImport = async () => {
    if (!selectedTable || uploadedFiles.length === 0 || !batchPreviewData) {
      return;
    }
    setIsProcessing(true);

    setUploadedFiles((prev) =>
      prev.map((f) => (f.status === "error" ? f : { ...f, status: "importing" as FileStatus })),
    );

    try {
      const batch = buildBatchRows(selectedTable, uploadedFiles);
      const totals = await importMutateAsync({
        data: batch.rows,
        table: selectedTable,
        mode: importMode,
      });

      setBatchDroppedDuplicates(batch.droppedDuplicates);
      setBatchPreviewData(totals);
      setUploadedFiles((prev) =>
        prev.map((f) => (f.status === "error" ? f : { ...f, status: "success" as FileStatus })),
      );
      success(
        `Completado: ${totals.inserted ?? 0} insertados, ${totals.updated ?? 0} actualizados, ${totals.skipped ?? 0} omitidos.`,
        "Importación",
      );
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Error al importar";
      toastError(errorMsg);
      setUploadedFiles((prev) =>
        prev.map((f) => (f.status === "error" ? f : { ...f, status: "error" as FileStatus })),
      );
    } finally {
      setIsProcessing(false);
    }
  };

  // Computed values
  const totalRows = uploadedFiles.reduce((sum, f) => sum + f.rowCount, 0);
  const isValidMapping =
    firstFile && currentTable ? isValidColumnMapping(currentTable, firstFile.columnMapping) : false;
  const hasPreviewData = batchPreviewData !== null;

  const columns = buildMappingColumns({
    firstFile,
    onMappingChanged: () => {
      setBatchDroppedDuplicates(0);
      setBatchPreviewData(null);
    },
    setUploadedFiles,
  });

  if (allowedTableOptions.length === 0) {
    return (
      <div className="space-y-4">
        <AccessDeniedAlert />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <TableSelectionCard
        allowedTableOptions={allowedTableOptions}
        currentTable={currentTable}
        onTableChange={handleTableChange}
        selectedTable={selectedTable}
      />

      <FileUploadSection
        disabled={isProcessing}
        onFileChange={handleFileChange}
        selectedTable={selectedTable}
      />

      <FilesListSection onRemove={handleRemoveFile} uploadedFiles={uploadedFiles} />

      {/* 4. Map Columns (showing first file's mapping) */}
      {firstFile && currentTable && (
        <ColumnMappingCard columns={columns} fields={currentTable.fields} totalRows={totalRows} />
      )}

      {/* 5. Preview Summary */}
      <ImportSummaryCard
        droppedDuplicates={batchDroppedDuplicates}
        previewData={batchPreviewData}
      />

      {/* 6. Import Mode Selection */}
      {hasPreviewData && (
        <ImportModeCard importMode={importMode} onModeChange={handleImportModeChange} />
      )}

      {/* 7. Actions */}
      {uploadedFiles.length > 0 && (
        <ImportActionsBar
          batchPreviewData={batchPreviewData}
          hasPreviewData={hasPreviewData}
          isProcessing={isProcessing}
          isValidMapping={isValidMapping}
          onImport={handleImport}
          onPreview={handlePreview}
          uploadedFilesCount={uploadedFiles.length}
        />
      )}
    </div>
  );
}

function ImportActionsBar(props: {
  batchPreviewData: CsvPreviewResponse | null;
  hasPreviewData: boolean;
  isProcessing: boolean;
  isValidMapping: boolean;
  onImport: () => void;
  onPreview: () => void;
  uploadedFilesCount: number;
}) {
  return (
    <div className="sticky bottom-0 z-10 -mx-4 flex justify-end gap-3 border-default-100 border-t bg-background/80 p-4 shadow-lg backdrop-blur-md sm:mx-0 sm:rounded-xl sm:border">
      <Button
        disabled={!props.isValidMapping || props.isProcessing || props.uploadedFilesCount === 0}
        onClick={props.onPreview}
        variant="secondary"
      >
        {props.isProcessing ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <FileUp className="mr-2 h-4 w-4" />
        )}
        {props.hasPreviewData ? "Recalcular vista previa" : "Generar vista previa"}
      </Button>

      <Button
        disabled={
          !props.hasPreviewData ||
          !props.isValidMapping ||
          props.isProcessing ||
          props.uploadedFilesCount === 0 ||
          (props.batchPreviewData?.errors?.length ?? 0) > 0
        }
        onClick={props.onImport}
      >
        {props.isProcessing ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <CheckCircle className="mr-2 h-4 w-4" />
        )}
        Confirmar Importación
      </Button>
    </div>
  );
}
