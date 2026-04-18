import {
  Alert,
  Button,
  Card,
  Checkbox,
  Chip,
  Input,
  Label,
  ListBox,
  Select,
  Tooltip,
} from "@heroui/react";
import { useMutation } from "@tanstack/react-query";
import type { ColumnDef, RowSelectionState } from "@tanstack/react-table";
import { AlertCircle, CheckCircle, FileUp, Loader2, Lock } from "lucide-react";
import Papa from "papaparse";
import { useState } from "react";

import { DataTable } from "@/components/data-table/DataTable";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { DoctoraliaCalendarJsonPanel } from "@/features/doctoralia/components/DoctoraliaCalendarJsonPanel";
import type { AuthContextType } from "@/features/auth/hooks/use-auth";
import {
  type CsvImportPayload,
  type CsvPreviewResponse,
  type CsvPreviewUpdateRow,
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
  progress?: number;
  rowCount: number;
  status: FileStatus;
}

interface PreviewUpdateCandidateRow extends CsvPreviewUpdateRow {
  id: string;
}

const HEADER_ALIAS_REGEX = /\(([^)]+)\)/;
const CSV_BATCH_SIZE = 500;
const MAX_PREVIEW_ERRORS = 100;
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
  columnMapping: Record<string, string>
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

const normalizeWithdrawIdForBatch = (value: unknown) => {
  if (typeof value === "string") return value.trim();
  if (value === null || value === undefined) return "";
  // Type narrowing: only process primitive values as strings
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value).trim();
  }
  return "";
};

function buildBatchRows(
  selectedTable: string,
  files: UploadedFile[]
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

function chunkRows<T>(rows: T[], size: number): T[][] {
  if (rows.length === 0) {
    return [];
  }

  const chunks: T[][] = [];
  for (let index = 0; index < rows.length; index += size) {
    chunks.push(rows.slice(index, index + size));
  }
  return chunks;
}

function mergePreviewResponses(
  accumulated: CsvPreviewResponse,
  current: CsvPreviewResponse,
  rowOffset = 0
): CsvPreviewResponse {
  const errors = [...(accumulated.errors ?? []), ...(current.errors ?? [])].slice(
    0,
    MAX_PREVIEW_ERRORS
  );
  const updateRows = [
    ...(accumulated.updateRows ?? []),
    ...((current.updateRows ?? []).map((row) => ({
      ...row,
      rowIndex: row.rowIndex + rowOffset,
    })) as CsvPreviewUpdateRow[]),
  ];

  return {
    errors,
    inserted: (accumulated.inserted ?? 0) + (current.inserted ?? 0),
    skipped: (accumulated.skipped ?? 0) + (current.skipped ?? 0),
    toInsert: accumulated.toInsert + current.toInsert,
    toSkip: accumulated.toSkip + current.toSkip,
    toUpdate: accumulated.toUpdate + current.toUpdate,
    updateRows,
    updated: (accumulated.updated ?? 0) + (current.updated ?? 0),
  };
}

function buildUpdateSelectionState(rows: CsvPreviewUpdateRow[]): RowSelectionState {
  return Object.fromEntries(rows.map((row) => [String(row.rowIndex), true]));
}

const isValidColumnMapping = (
  table: TableOption | undefined,
  columnMapping: Record<string, string>
): boolean => {
  if (!table) {
    return false;
  }
  const requiredFields = table.fields.filter((field) => field.required);
  return requiredFields.every(
    (field) => columnMapping[field.name] && columnMapping[field.name] !== ""
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
  fields: FieldDefinition[]
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
  existingMapping: Record<string, string>
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
  tableValue: string
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
      { name: "receiptDate", required: false, type: "date" },
      { name: "clientRUT", required: false, type: "string" },
      { name: "clientName", required: false, type: "string" },
      { name: "folio", required: true, type: "string" },
      { name: "documentType", required: false, type: "number" },
      { name: "saleType", required: false, type: "string" },
      { name: "registerNumber", required: false, type: "number" },
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
  {
    fields: [],
    label: "Calendario Doctoralia (JSON)",
    value: "doctoralia_calendar",
  },
];

const SUPPORTED_TABLES = new Set([
  "counterparts",
  "daily_balances",
  "daily_production_balances",
  "doctoralia_calendar",
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
  doctoralia_calendar: { action: "update", subject: "DoctoraliaFacility" },
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
      <Alert.Indicator>
        <Lock className="h-4 w-4" />
      </Alert.Indicator>
      <Alert.Content>
        <Alert.Description>
          <div className="flex flex-col">
            <span className="font-bold">Acceso restringido</span>
            <span>No tienes permisos para importar datos en ninguna tabla disponible.</span>
          </div>
        </Alert.Description>
      </Alert.Content>
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
        <div className="flex flex-col gap-2">
          <Label htmlFor="csv-upload-input">Archivos CSV</Label>
          <Input
            id="csv-upload-input"
            accept=".csv,text/csv"
            disabled={disabled}
            fullWidth
            multiple
            onChange={onFileChange}
            type="file"
            variant="secondary"
          />
        </div>
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
            progress={uploadedFile.progress}
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
  importMode,
  previewData,
}: {
  droppedDuplicates: number;
  importMode: "insert-only" | "insert-or-update" | "update-only";
  previewData: CsvPreviewResponse | null;
}) {
  if (!previewData) {
    return null;
  }

  const summary =
    importMode === "insert-only"
      ? {
          toInsert: previewData.toInsert ?? 0,
          toSkip: (previewData.toUpdate ?? 0) + (previewData.toSkip ?? 0),
          toUpdate: 0,
        }
      : importMode === "update-only"
        ? {
            toInsert: 0,
            toSkip: (previewData.toInsert ?? 0) + (previewData.toSkip ?? 0),
            toUpdate: previewData.toUpdate ?? 0,
          }
        : {
            toInsert: previewData.toInsert ?? 0,
            toSkip: previewData.toSkip ?? 0,
            toUpdate: previewData.toUpdate ?? 0,
          };

  const errorOccurrences = new Map<string, number>();
  const validationErrors = (previewData.errors ?? []).slice(0, 50).map((err) => {
    const nextCount = (errorOccurrences.get(err) ?? 0) + 1;
    errorOccurrences.set(err, nextCount);
    return { key: `${err}-${nextCount}`, message: err };
  });

  return (
    <Card className="border-primary/20 bg-primary/5">
      <Card.Content className="p-3">
        <span className="mb-3 block font-semibold text-lg">Vista Previa de Importación</span>
        {droppedDuplicates > 0 && (
          <div className="mb-3 rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-warning text-xs">
            Se detectaron {droppedDuplicates} filas repetidas por <code>withdrawId</code> entre
            archivos y se omitieron del cálculo del lote.
          </div>
        )}
        <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-3">
          <div className="rounded-lg border border-default-100 bg-background p-2.5 shadow-sm">
            <div className="mb-1 text-xs uppercase tracking-wider opacity-70">Insertar</div>
            <div className="font-bold text-2xl text-success">{summary.toInsert}</div>
          </div>
          <div className="rounded-lg border border-default-100 bg-background p-2.5 shadow-sm">
            <div className="mb-1 text-xs uppercase tracking-wider opacity-70">Actualizar</div>
            <div className="font-bold text-2xl text-info">{summary.toUpdate}</div>
          </div>
          <div className="rounded-lg border border-default-100 bg-background p-2.5 shadow-sm">
            <div className="mb-1 text-xs uppercase tracking-wider opacity-70">Omitir</div>
            <div className="font-bold text-2xl text-warning">{summary.toSkip}</div>
          </div>
        </div>

        {(previewData.errors?.length ?? 0) > 0 && (
          <Alert className="mb-0" status="warning">
            <Alert.Indicator>
              <AlertCircle className="h-4 w-4" />
            </Alert.Indicator>
            <Alert.Content>
              <Alert.Description>
                <div className="flex w-full flex-col gap-2">
                  <div className="font-medium">
                    Errores de validación ({previewData.errors?.length ?? 0})
                  </div>
                  <ul className="max-h-32 list-inside list-disc overflow-y-auto rounded bg-background/50 p-2 text-xs opacity-90">
                    {validationErrors.map((err) => (
                      <li key={err.key}>{err.message}</li>
                    ))}
                    {(previewData.errors?.length ?? 0) > 50 && (
                      <li className="text-default-500">
                        ...y {(previewData.errors?.length ?? 0) - 50} más
                      </li>
                    )}
                  </ul>
                </div>
              </Alert.Description>
            </Alert.Content>
          </Alert>
        )}
      </Card.Content>
    </Card>
  );
}

function UpdateSelectionCard({
  isLoadingDetails = false,
  onLoadDetails,
  onSelectionChange,
  rowSelection,
  rows,
}: {
  isLoadingDetails?: boolean;
  onLoadDetails?: () => void;
  onSelectionChange: React.Dispatch<React.SetStateAction<RowSelectionState>>;
  rowSelection: RowSelectionState;
  rows: PreviewUpdateCandidateRow[];
}) {
  if (rows.length === 0) {
    return null;
  }

  const selectedIds = new Set(
    Object.entries(rowSelection)
      .filter(([, isSelected]) => Boolean(isSelected))
      .map(([rowId]) => rowId)
  );
  const selectedCount = rows.filter((row) => selectedIds.has(row.id)).length;
  const allSelected = rows.length > 0 && selectedCount === rows.length;
  const partiallySelected = selectedCount > 0 && selectedCount < rows.length;

  const columns: ColumnDef<PreviewUpdateCandidateRow>[] = [
    {
      cell: ({ row }) => (
        <Checkbox
          aria-label={`Seleccionar fila ${row.original.rowIndex + 1}`}
          isSelected={selectedIds.has(row.original.id)}
          onChange={() => {
            const rowId = row.original.id;
            onSelectionChange((prev) => ({
              ...prev,
              [rowId]: !prev[rowId],
            }));
          }}
          slot="selection"
          variant="secondary"
        >
          <Checkbox.Control>
            <Checkbox.Indicator />
          </Checkbox.Control>
        </Checkbox>
      ),
      header: () => (
        <Checkbox
          aria-label="Seleccionar todas las filas a actualizar"
          isIndeterminate={partiallySelected}
          isSelected={allSelected}
          onChange={() => {
            onSelectionChange(allSelected ? {} : buildUpdateSelectionState(rows));
          }}
          slot="selection"
          variant="secondary"
        >
          <Checkbox.Control>
            <Checkbox.Indicator />
          </Checkbox.Control>
        </Checkbox>
      ),
      id: "select",
    },
    {
      accessorKey: "rowIndex",
      cell: ({ row }) => row.original.rowIndex + 1,
      header: "Fila CSV",
    },
    {
      accessorKey: "key",
      cell: ({ row }) => <span className="font-mono text-xs">{row.original.key}</span>,
      header: "Clave",
    },
    {
      accessorKey: "summary",
      header: "Resumen",
    },
  ];

  return (
    <Card>
      <Card.Header>
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <Card.Title>Filas a actualizar</Card.Title>
            <Card.Description>
              Selecciona cuáles filas existentes quieres actualizar. Las filas nuevas se importan
              igual.
            </Card.Description>
          </div>
          <div className="flex items-center gap-2">
            {onLoadDetails && (
              <Button
                isDisabled={isLoadingDetails}
                onPress={onLoadDetails}
                size="sm"
                variant="ghost"
              >
                {isLoadingDetails ? <Loader2 className="mr-2 h-4 w-4 " /> : null}
                Recargar detalle
              </Button>
            )}
            <Chip color={selectedCount === rows.length ? "success" : "warning"} variant="soft">
              <Chip.Label>
                {selectedCount}/{rows.length} seleccionadas
              </Chip.Label>
            </Chip>
          </div>
        </div>
      </Card.Header>
      <Card.Content className="space-y-3">
        <div className="flex gap-2">
          <Button
            onPress={() => onSelectionChange(buildUpdateSelectionState(rows))}
            size="sm"
            variant="secondary"
          >
            Seleccionar todas
          </Button>
          <Button onPress={() => onSelectionChange({})} size="sm" variant="ghost">
            Limpiar selección
          </Button>
        </div>

        <DataTable
          columns={columns}
          data={rows}
          containerVariant="plain"
          enableExport={false}
          enablePagination={false}
          enableToolbar
          noDataMessage="No hay filas para actualizar."
          rowSelection={rowSelection}
          scrollMaxHeight="min(40dvh, 420px)"
        />
      </Card.Content>
    </Card>
  );
}

function UpdateDetailLoaderCard({
  isLoading,
  onLoad,
  pendingUpdates,
}: {
  isLoading: boolean;
  onLoad: () => void;
  pendingUpdates: number;
}) {
  if (pendingUpdates <= 0) {
    return null;
  }

  return (
    <Card>
      <Card.Header>
        <div>
          <Card.Title>Detalle de actualizaciones</Card.Title>
          <Card.Description>
            La vista previa cargó solo el resumen para evitar bloquear el navegador. Si quieres
            revisar y seleccionar fila por fila, carga el detalle manualmente.
          </Card.Description>
        </div>
      </Card.Header>
      <Card.Content className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Chip color="warning" variant="soft">
          <Chip.Label>{pendingUpdates} filas detectadas para actualizar</Chip.Label>
        </Chip>
        <Button isDisabled={isLoading} onPress={onLoad} variant="secondary">
          {isLoading ? <Loader2 className="mr-2 h-4 w-4 " /> : null}
          Cargar detalle de actualizaciones
        </Button>
      </Card.Content>
    </Card>
  );
}

function ImportModeCard({
  importMode,
  onModeChange,
}: {
  importMode: "insert-only" | "insert-or-update" | "update-only";
  onModeChange: (mode: "insert-only" | "insert-or-update" | "update-only") => void;
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
              "flex-1 rounded-lg border-2 p-4 text-left ",
              importMode === "insert-only"
                ? "border-primary/50 bg-primary/5"
                : "border-default-200 hover:border-default-300"
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
              "flex-1 rounded-lg border-2 p-4 text-left ",
              importMode === "insert-or-update"
                ? "border-primary/50 bg-primary/5"
                : "border-default-200 hover:border-default-300"
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

          <Button
            className={cn(
              "flex-1 rounded-lg border-2 p-4 text-left ",
              importMode === "update-only"
                ? "border-primary/50 bg-primary/5"
                : "border-default-200 hover:border-default-300"
            )}
            onPress={() => onModeChange("update-only")}
            type="button"
            variant="ghost"
          >
            <div className="flex items-center gap-3">
              <Chip
                className="min-w-24 justify-center text-center"
                color={importMode === "update-only" ? "accent" : "default"}
                size="sm"
                variant={importMode === "update-only" ? "primary" : "tertiary"}
              >
                {importMode === "update-only" ? "Seleccionado" : "Elegir"}
              </Chip>
              <div className="flex-1">
                <div className="font-semibold text-sm">Solo actualizar</div>
                <div className="text-xs opacity-60">
                  Actualiza solo registros existentes. Los nuevos se omiten.
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
              <Tooltip.Trigger aria-label="Campo requerido">
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
              })
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
  selectedTable: string
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
      }
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
  const [processingLabel, setProcessingLabel] = useState("");
  const [batchDroppedDuplicates, setBatchDroppedDuplicates] = useState(0);
  const [batchPreviewData, setBatchPreviewData] = useState<CsvPreviewResponse | null>(null);
  const [previewBatchRows, setPreviewBatchRows] = useState<Record<string, number | string>[]>([]);
  const [updateRowSelection, setUpdateRowSelection] = useState<RowSelectionState>({});
  const [isLoadingUpdateDetails, setIsLoadingUpdateDetails] = useState(false);
  const [importMode, setImportMode] = useState<"insert-only" | "insert-or-update" | "update-only">(
    "insert-or-update"
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
    setPreviewBatchRows([]);
    setUpdateRowSelection({});
    setIsLoadingUpdateDetails(false);
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
    setPreviewBatchRows([]);
    setUpdateRowSelection({});
    setIsLoadingUpdateDetails(false);
    setUploadedFiles((prev) => [...prev, ...newFiles]);
    e.target.value = "";
  };

  const handleRemoveFile = (id: string) => {
    setUploadedFiles((prev) => prev.filter((f) => f.id !== id));
    setBatchDroppedDuplicates(0);
    setBatchPreviewData(null);
    setPreviewBatchRows([]);
    setUpdateRowSelection({});
    setIsLoadingUpdateDetails(false);
  };

  const updateBatchFileState = (status: FileStatus, progress?: number, error?: string) => {
    setUploadedFiles((prev) =>
      prev.map((file) => {
        if (file.status === "error" && !error) {
          return file;
        }

        return {
          ...file,
          error: error ?? (status === "error" ? file.error : undefined),
          progress,
          status,
        };
      })
    );
  };

  const runBatchedMutation = async ({
    actionLabel,
    mode,
    rows,
    runChunk,
    status,
  }: {
    actionLabel: string;
    mode: "insert-only" | "insert-or-update" | "update-only";
    rows: Record<string, number | string>[];
    runChunk: (payload: CsvImportPayload) => Promise<CsvPreviewResponse>;
    status: FileStatus;
  }) => {
    const chunks = chunkRows(rows, CSV_BATCH_SIZE);
    let aggregated: CsvPreviewResponse = {
      errors: [],
      inserted: 0,
      skipped: 0,
      toInsert: 0,
      toSkip: 0,
      toUpdate: 0,
      updated: 0,
    };

    if (chunks.length === 0) {
      return aggregated;
    }

    updateBatchFileState(status, 0);
    setProcessingLabel(`${actionLabel} 0/${chunks.length} lotes`);
    let rowOffset = 0;

    for (const [index, chunk] of chunks.entries()) {
      const response = await runChunk({
        data: chunk,
        includeUpdateRows: false,
        mode,
        table: selectedTable as CsvImportPayload["table"],
      });

      aggregated = mergePreviewResponses(aggregated, response, rowOffset);
      rowOffset += chunk.length;

      const progress = Math.round(((index + 1) / chunks.length) * 100);
      updateBatchFileState(status, progress);
      setProcessingLabel(`${actionLabel} ${index + 1}/${chunks.length} lotes`);
    }

    return aggregated;
  };

  const handlePreview = async () => {
    if (!selectedTable || uploadedFiles.length === 0) {
      return;
    }

    setIsProcessing(true);
    setBatchPreviewData(null);
    setPreviewBatchRows([]);
    setUpdateRowSelection({});
    setIsLoadingUpdateDetails(false);

    try {
      const batch = buildBatchRows(selectedTable, uploadedFiles);
      const previewData = await runBatchedMutation({
        actionLabel: "Previsualizando",
        mode: importMode,
        rows: batch.rows,
        runChunk: previewMutateAsync,
        status: "previewing",
      });

      setBatchDroppedDuplicates(batch.droppedDuplicates);
      setBatchPreviewData(previewData);
      setPreviewBatchRows(batch.rows);
      setUpdateRowSelection(buildUpdateSelectionState(previewData.updateRows ?? []));
      updateBatchFileState("ready");
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Error en vista previa";
      toastError(errorMsg);
      updateBatchFileState("ready", undefined, errorMsg);
    } finally {
      setIsProcessing(false);
      setProcessingLabel("");
    }
  };

  const handleLoadUpdateDetails = async () => {
    if (!selectedTable || previewBatchRows.length === 0 || importMode !== "insert-or-update") {
      return;
    }

    setIsLoadingUpdateDetails(true);

    try {
      const detailPreview = await runBatchedMutation({
        actionLabel: "Cargando detalle",
        mode: importMode,
        rows: previewBatchRows,
        runChunk: (payload) =>
          previewMutateAsync({
            ...payload,
            includeUpdateRows: true,
          }),
        status: "previewing",
      });

      setBatchPreviewData((prev) =>
        prev
          ? {
              ...prev,
              updateRows: detailPreview.updateRows ?? [],
            }
          : detailPreview
      );
      setUpdateRowSelection(buildUpdateSelectionState(detailPreview.updateRows ?? []));
      updateBatchFileState("ready");
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Error al cargar detalle";
      toastError(errorMsg);
      updateBatchFileState("ready", undefined, errorMsg);
    } finally {
      setIsLoadingUpdateDetails(false);
      setProcessingLabel("");
    }
  };

  const handleImportModeChange = (mode: "insert-only" | "insert-or-update" | "update-only") => {
    if (mode === importMode) {
      return;
    }
    // Solo cambiar el modo: no recalcular el preview
    // El preview ya es válido, solo cambia el método de procesamiento
    setImportMode(mode);
  };

  const handleImport = async () => {
    if (!selectedTable || uploadedFiles.length === 0 || !batchPreviewData) {
      return;
    }
    setIsProcessing(true);

    try {
      let workingPreviewData = batchPreviewData;
      const updateIndexes = new Set((batchPreviewData.updateRows ?? []).map((row) => row.rowIndex));
      const selectedUpdateIndexes = new Set(
        Object.entries(updateRowSelection)
          .filter(([, isSelected]) => Boolean(isSelected))
          .map(([rowIndex]) => Number(rowIndex))
      );

      // Filter rows based on import mode
      let rowsToImport = previewBatchRows;
      if (importMode === "insert-only") {
        if (
          (workingPreviewData.insertRowIndexes ?? []).length === 0 &&
          (workingPreviewData.toInsert ?? 0) > 0
        ) {
          setProcessingLabel("Preparando filas nuevas...");
          const insertPreview = await runBatchedMutation({
            actionLabel: "Identificando nuevas",
            mode: importMode,
            rows: previewBatchRows,
            runChunk: (payload) =>
              previewMutateAsync({
                ...payload,
                includeInsertRowIndexes: true,
              }),
            status: "previewing",
          });

          const insertRowIndexes = insertPreview.insertRowIndexes ?? [];
          workingPreviewData = {
            ...workingPreviewData,
            insertRowIndexes,
          };
          setBatchPreviewData((prev) =>
            prev
              ? {
                  ...prev,
                  insertRowIndexes,
                }
              : workingPreviewData
          );
        }

        const insertIndexes = new Set(workingPreviewData.insertRowIndexes ?? []);
        rowsToImport =
          insertIndexes.size > 0
            ? previewBatchRows.filter((_row, index) => insertIndexes.has(index))
            : (workingPreviewData.toInsert ?? 0) === 0
              ? []
              : previewBatchRows;
      } else if (importMode === "update-only") {
        // For update-only: only send rows that are updates AND selected
        rowsToImport = previewBatchRows.filter(
          (_, index) => updateIndexes.has(index) && selectedUpdateIndexes.has(index)
        );
      } else if (importMode === "insert-or-update" && updateIndexes.size > 0) {
        // For insert-or-update: send all rows except unselected updates
        rowsToImport = previewBatchRows.filter(
          (_row, index) => !updateIndexes.has(index) || selectedUpdateIndexes.has(index)
        );
      }
      // For insert-only: send all rows (backend will skip existing ones)

      const totals = await runBatchedMutation({
        actionLabel: "Importando",
        mode: importMode,
        rows: rowsToImport,
        runChunk: importMutateAsync,
        status: "importing",
      });

      setBatchPreviewData(totals);
      updateBatchFileState("success");
      success(
        `Completado: ${totals.inserted ?? 0} insertados, ${totals.updated ?? 0} actualizados, ${totals.skipped ?? 0} omitidos.`,
        "Importación"
      );
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Error al importar";
      toastError(errorMsg);
      updateBatchFileState("ready", undefined, errorMsg);
    } finally {
      setIsProcessing(false);
      setProcessingLabel("");
    }
  };

  // Computed values
  const totalRows = uploadedFiles.reduce((sum, f) => sum + f.rowCount, 0);
  const isValidMapping =
    firstFile && currentTable ? isValidColumnMapping(currentTable, firstFile.columnMapping) : false;
  const hasPreviewData = batchPreviewData !== null;
  const hasLoadedUpdateDetails = Array.isArray(batchPreviewData?.updateRows);
  const updateCandidateRows: PreviewUpdateCandidateRow[] = (batchPreviewData?.updateRows ?? []).map(
    (row) => ({
      ...row,
      id: String(row.rowIndex),
    })
  );
  const selectedUpdateCount = updateCandidateRows.filter(
    (row) => updateRowSelection[row.id]
  ).length;
  const pendingImportCount =
    importMode === "insert-only"
      ? (batchPreviewData?.toInsert ?? 0)
      : importMode === "update-only"
        ? (batchPreviewData?.toUpdate ?? 0)
        : (batchPreviewData?.toInsert ?? 0) +
          (hasLoadedUpdateDetails ? selectedUpdateCount : (batchPreviewData?.toUpdate ?? 0));

  const columns = buildMappingColumns({
    firstFile,
    onMappingChanged: () => {
      setBatchDroppedDuplicates(0);
      setBatchPreviewData(null);
      setPreviewBatchRows([]);
      setUpdateRowSelection({});
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

  const isDoctoraliaCalendar = selectedTable === "doctoralia_calendar";

  return (
    <div className="space-y-3">
      <TableSelectionCard
        allowedTableOptions={allowedTableOptions}
        currentTable={currentTable}
        onTableChange={handleTableChange}
        selectedTable={selectedTable}
      />

      {isDoctoraliaCalendar && <DoctoraliaCalendarJsonPanel />}

      {!isDoctoraliaCalendar && (
        <FileUploadSection
          disabled={isProcessing}
          onFileChange={handleFileChange}
          selectedTable={selectedTable}
        />
      )}

      {!isDoctoraliaCalendar && (
        <FilesListSection onRemove={handleRemoveFile} uploadedFiles={uploadedFiles} />
      )}

      {/* 4. Map Columns (showing first file's mapping) */}
      {!isDoctoraliaCalendar && firstFile && currentTable && (
        <ColumnMappingCard columns={columns} fields={currentTable.fields} totalRows={totalRows} />
      )}

      {/* 5. Preview Summary */}
      {!isDoctoraliaCalendar && (
        <ImportSummaryCard
          droppedDuplicates={batchDroppedDuplicates}
          importMode={importMode}
          previewData={batchPreviewData}
        />
      )}

      {!isDoctoraliaCalendar &&
        hasPreviewData &&
        importMode === "insert-or-update" &&
        (batchPreviewData?.toUpdate ?? 0) > 0 &&
        !hasLoadedUpdateDetails && (
          <UpdateDetailLoaderCard
            isLoading={isLoadingUpdateDetails}
            onLoad={handleLoadUpdateDetails}
            pendingUpdates={batchPreviewData?.toUpdate ?? 0}
          />
        )}

      {!isDoctoraliaCalendar &&
        hasPreviewData &&
        importMode === "insert-or-update" &&
        updateCandidateRows.length > 0 && (
          <UpdateSelectionCard
            isLoadingDetails={isLoadingUpdateDetails}
            onLoadDetails={handleLoadUpdateDetails}
            onSelectionChange={setUpdateRowSelection}
            rowSelection={updateRowSelection}
            rows={updateCandidateRows}
          />
        )}

      {/* 6. Import Mode Selection */}
      {!isDoctoraliaCalendar && hasPreviewData && (
        <ImportModeCard importMode={importMode} onModeChange={handleImportModeChange} />
      )}

      {/* 7. Actions */}
      {!isDoctoraliaCalendar && uploadedFiles.length > 0 && (
        <ImportActionsBar
          batchPreviewData={batchPreviewData}
          hasPreviewData={hasPreviewData}
          isProcessing={isProcessing}
          isValidMapping={isValidMapping}
          onImport={handleImport}
          onPreview={handlePreview}
          pendingImportCount={pendingImportCount}
          processingLabel={processingLabel}
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
  pendingImportCount: number;
  processingLabel?: string;
  uploadedFilesCount: number;
}) {
  return (
    <div className="sticky bottom-0 z-10 -mx-4 flex flex-col gap-3 border-default-100 border-t bg-background/80 p-4 shadow-lg backdrop-blur-md sm:mx-0 sm:rounded-xl sm:border">
      {props.processingLabel ? (
        <div className="text-default-500 text-sm">{props.processingLabel}</div>
      ) : null}

      <div className="flex justify-end gap-3">
        <Button
          isDisabled={!props.isValidMapping || props.isProcessing || props.uploadedFilesCount === 0}
          onPress={props.onPreview}
          variant="secondary"
        >
          {props.isProcessing ? (
            <Loader2 className="mr-2 h-4 w-4 " />
          ) : (
            <FileUp className="mr-2 h-4 w-4" />
          )}
          {props.hasPreviewData ? "Recalcular vista previa" : "Generar vista previa"}
        </Button>

        <Button
          isDisabled={
            !props.hasPreviewData ||
            !props.isValidMapping ||
            props.isProcessing ||
            props.pendingImportCount === 0 ||
            props.uploadedFilesCount === 0 ||
            (props.batchPreviewData?.errors?.length ?? 0) > 0
          }
          onPress={props.onImport}
        >
          {props.isProcessing ? (
            <Loader2 className="mr-2 h-4 w-4 " />
          ) : (
            <CheckCircle className="mr-2 h-4 w-4" />
          )}
          Confirmar Importación ({props.pendingImportCount})
        </Button>
      </div>
    </div>
  );
}
