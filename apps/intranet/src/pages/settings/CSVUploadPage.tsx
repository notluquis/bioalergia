import { Chip } from "@heroui/react";
import { useMutation } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { AlertCircle, CheckCircle, FileUp, Loader2, Lock } from "lucide-react";
import Papa from "papaparse";
import { useState } from "react";

import { DataTable } from "@/components/data-table/DataTable";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { FileInput } from "@/components/ui/FileInput";
import { Select, SelectItem } from "@/components/ui/Select";
import { Tooltip } from "@/components/ui/Tooltip";
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
  period?: string; // Extracted from filename (YYYYMM format)
  previewData?: CsvPreviewResponse;
  rowCount: number;
  status: FileStatus;
}

const HEADER_ALIAS_REGEX = /\(([^)]+)\)/;
const PERIOD_REGEX = /Periodo[_\s]+(\d{6})/i;
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
      if (csvColumn && row[csvColumn] !== undefined) {
        transformed[dbField] = row[csvColumn];
      }
    }
    return transformed;
  });

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
      { name: "year", required: true, type: "number" },
      { name: "month", required: true, type: "number" },
      { name: "daysWorked", required: false, type: "number" },
      { name: "hoursWorked", required: false, type: "number" },
      { name: "overtimeHours", required: false, type: "number" },
      { name: "bonusAmount", required: false, type: "number" },
      { name: "commissionAmount", required: false, type: "number" },
      { name: "advanceAmount", required: false, type: "number" },
    ],

    label: "Libro Remuneraciones",
    value: "employee_timesheets",
  },
  {
    fields: [
      { name: "period", required: true, type: "string" },
      { name: "documentDate", required: true, type: "date" },
      { name: "receiptDate", required: true, type: "date" },
      { name: "providerRUT", required: true, type: "string" },
      { name: "providerName", required: true, type: "string" },
      { name: "folio", required: true, type: "string" },
      { name: "documentType", required: false, type: "number" },
      { name: "purchaseType", required: false, type: "string" },
      { name: "registerNumber", required: false, type: "number" },
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
      { name: "period", required: true, type: "string" },
      { name: "documentDate", required: true, type: "date" },
      { name: "receiptDate", required: true, type: "date" },
      { name: "clientRUT", required: true, type: "string" },
      { name: "clientName", required: true, type: "string" },
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
      { name: "transportPassageAmount", required: false, type: "number" },
      { name: "internationalTransportAmount", required: false, type: "number" },
      { name: "internalNumber", required: false, type: "number" },
      { name: "branchCode", required: false, type: "string" },
      { name: "purchaseId", required: false, type: "string" },
      { name: "shippingOrderId", required: false, type: "string" },
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
    <Alert variant="warning">
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
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileUp className="h-5 w-5 text-primary" />
          1. Seleccionar destino
        </CardTitle>
        <CardDescription>Elige la tabla donde deseas importar los datos.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
          <div className="w-full sm:w-1/3">
            <Select
              className="w-full max-w-md"
              label="Tipo de Datos (Tabla)"
              onChange={(val) => onTableChange(val as string)}
              value={selectedTable}
            >
              <SelectItem id="" key="">
                -- Seleccionar tabla --
              </SelectItem>
              {allowedTableOptions.map((table) => (
                <SelectItem id={table.value} key={table.value}>
                  {table.label}
                </SelectItem>
              ))}
            </Select>
          </div>

          {currentTable && (
            <div className="flex-1 rounded-lg bg-default-50/50 p-4">
              <h3 className="mb-2 font-bold text-xs uppercase tracking-wide opacity-70">
                Campos requeridos
              </h3>
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
      </CardContent>
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
      <CardHeader>
        <CardTitle>Mapeo de columnas</CardTitle>
        <CardDescription>
          Relaciona las columnas de tu CSV con los campos de la base de datos.
          <br />
          <span className="text-xs opacity-70">Total de filas: {totalRows}</span>
        </CardDescription>
      </CardHeader>
      <div className="border-t">
        <DataTable
          columns={columns}
          data={fields}
          containerVariant="plain"
          enablePagination={false}
          enableToolbar={false}
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
      <CardHeader>
        <CardTitle>Cargar archivos</CardTitle>
        <CardDescription>
          Arrastra uno o más archivos CSV aquí o haz clic para seleccionar
        </CardDescription>
      </CardHeader>
      <CardContent>
        <FileInput accept=".csv" disabled={disabled} multiple onChange={onFileChange} />
      </CardContent>
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
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Archivos cargados</CardTitle>
            <CardDescription>
              {uploadedFiles.length} archivo{uploadedFiles.length !== 1 ? "s" : ""} · {totalRows}{" "}
              filas totales
            </CardDescription>
          </div>
          {(successCount > 0 || errorCount > 0) && (
            <div className="flex gap-2 text-sm">
              {successCount > 0 && (
                <Chip color="success" size="sm" variant="soft">
                  {successCount} exitoso{successCount !== 1 ? "s" : ""}
                </Chip>
              )}
              {errorCount > 0 && (
                <Chip color="danger" size="sm" variant="soft">
                  {errorCount} con error{errorCount !== 1 ? "es" : ""}
                </Chip>
              )}
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
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
      </CardContent>
    </Card>
  );
}

function ImportSummaryCard({ uploadedFiles }: { uploadedFiles: UploadedFile[] }) {
  const hasPreviewData = uploadedFiles.some((f) => f.previewData);

  if (!hasPreviewData) {
    return null;
  }

  // Aggregate preview data across all files
  const aggregated = uploadedFiles.reduce(
    (acc, file) => {
      if (file.previewData) {
        acc.toInsert += file.previewData.toInsert ?? 0;
        acc.toUpdate += file.previewData.toUpdate ?? 0;
        acc.toSkip += file.previewData.toSkip ?? 0;
        if (file.previewData.errors) {
          acc.errors.push(...file.previewData.errors);
        }
      }
      return acc;
    },
    { errors: [] as string[], toInsert: 0, toSkip: 0, toUpdate: 0 },
  );

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardContent className="p-6">
        <h3 className="mb-4 font-semibold text-lg">Vista Previa de Importación</h3>
        <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-3">
          <div className="rounded-lg border border-default-100 bg-background p-3 shadow-sm">
            <div className="mb-1 text-xs uppercase tracking-wider opacity-70">Insertar</div>
            <div className="font-bold text-2xl text-success">{aggregated.toInsert}</div>
          </div>
          <div className="rounded-lg border border-default-100 bg-background p-3 shadow-sm">
            <div className="mb-1 text-xs uppercase tracking-wider opacity-70">Actualizar</div>
            <div className="font-bold text-2xl text-info">{aggregated.toUpdate}</div>
          </div>
          <div className="rounded-lg border border-default-100 bg-background p-3 shadow-sm">
            <div className="mb-1 text-xs uppercase tracking-wider opacity-70">Omitir</div>
            <div className="font-bold text-2xl text-warning">{aggregated.toSkip}</div>
          </div>
        </div>

        {aggregated.errors.length > 0 && (
          <Alert className="mb-0" variant="warning">
            <div className="flex w-full flex-col gap-2">
              <div className="flex items-center gap-2 font-medium">
                <AlertCircle className="h-4 w-4" />
                Errores de validación ({aggregated.errors.length})
              </div>
              <ul className="max-h-32 list-inside list-disc overflow-y-auto rounded bg-background/50 p-2 text-xs opacity-90">
                {aggregated.errors.slice(0, 50).map((err: string, i: number) => (
                  <li key={`${i}-${err.substring(0, 20)}`}>{err}</li>
                ))}
                {aggregated.errors.length > 50 && (
                  <li className="text-default-500">...y {aggregated.errors.length - 50} más</li>
                )}
              </ul>
            </div>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}

function buildMappingColumns({
  firstFile,
  setUploadedFiles,
}: {
  firstFile: UploadedFile | undefined;
  setUploadedFiles: React.Dispatch<React.SetStateAction<UploadedFile[]>>;
}): ColumnDef<FieldDefinition>[] {
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
            <Tooltip content="Requerido">
              <span className="text-danger text-xs">*</span>
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
          label="Columna CSV"
          onChange={(val) => {
            setUploadedFiles((prev) =>
              prev.map((file, idx) => {
                if (idx === 0) {
                  // Update first file's mapping
                  return {
                    ...file,
                    columnMapping: {
                      ...file.columnMapping,
                      [row.original.name]: val as string,
                    },
                  };
                }
                return file;
              }),
            );
          }}
          value={firstFile.columnMapping[row.original.name] ?? ""}
        >
          <SelectItem id="" key="">
            -- Ignorar / Sin mapear --
          </SelectItem>
          {firstFile.csvHeaders.map((header) => (
            <SelectItem id={header} key={header}>
              {header}
            </SelectItem>
          ))}
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

// Helper to extract period from filename (e.g., "Periodo_202312" or "Periodo_202312.csv")
function extractPeriodFromFilename(filename: string): string | undefined {
  const match = filename.match(PERIOD_REGEX);
  return match?.[1];
}

// Helper to parse a single file
async function parseFile(
  file: File,
  currentTable: TableOption | undefined,
  selectedTable: string,
): Promise<UploadedFile> {
  try {
    // Extract period from filename
    const period = extractPeriodFromFilename(file.name);

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
        period,
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
      period,
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

export function CSVUploadPage() {
  const { can } = useAuth();
  const { success } = useToast();

  // State
  const [selectedTable, setSelectedTable] = useState<string>("");
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

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

    setUploadedFiles((prev) => [...prev, ...newFiles]);
    e.target.value = "";
  };

  const handleRemoveFile = (id: string) => {
    setUploadedFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const handlePreview = async () => {
    if (!selectedTable || uploadedFiles.length === 0) {
      return;
    }

    setIsProcessing(true);

    // Process files sequentially
    for (const file of uploadedFiles) {
      if (file.status === "error") {
        continue;
      }

      // Update status to previewing
      setUploadedFiles((prev) =>
        prev.map((f) => (f.id === file.id ? { ...f, status: "previewing" as FileStatus } : f)),
      );

      try {
        const transformedData = buildTransformedData(file.csvData, file.columnMapping);
        const previewData = await previewMutateAsync({
          data: transformedData,
          period: file.period,
          table: selectedTable,
        });

        // Update with preview data
        setUploadedFiles((prev) =>
          prev.map((f) =>
            f.id === file.id ? { ...f, previewData, status: "ready" as FileStatus } : f,
          ),
        );
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : "Error en vista previa";
        setUploadedFiles((prev) =>
          prev.map((f) =>
            f.id === file.id ? { ...f, error: errorMsg, status: "error" as FileStatus } : f,
          ),
        );
      }
    }

    setIsProcessing(false);
  };

  const processFileForImport = async (
    file: UploadedFile,
    selectedTable: string,
    importMutateAsync: (payload: CsvImportPayload) => Promise<CsvPreviewResponse>,
  ) => {
    setUploadedFiles((prev) =>
      prev.map((f) => (f.id === file.id ? { ...f, status: "importing" as FileStatus } : f)),
    );

    try {
      const transformedData = buildTransformedData(file.csvData, file.columnMapping);
      const result = await importMutateAsync({
        data: transformedData,
        period: file.period,
        table: selectedTable,
      });

      setUploadedFiles((prev) =>
        prev.map((f) =>
          f.id === file.id ? { ...f, previewData: result, status: "success" as FileStatus } : f,
        ),
      );

      return result;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Error al importar";
      setUploadedFiles((prev) =>
        prev.map((f) =>
          f.id === file.id ? { ...f, error: errorMsg, status: "error" as FileStatus } : f,
        ),
      );
      return null;
    }
  };

  const handleImport = async () => {
    if (!selectedTable || uploadedFiles.length === 0) {
      return;
    }

    setIsProcessing(true);
    const totals = { inserted: 0, skipped: 0, updated: 0 };

    // Process each file
    for (const file of uploadedFiles) {
      if (file.status === "error") {
        continue;
      }

      const result = await processFileForImport(file, selectedTable, importMutateAsync);
      if (result) {
        totals.inserted += result.inserted ?? 0;
        totals.updated += result.updated ?? 0;
        totals.skipped += result.skipped ?? 0;
      }
    }

    setIsProcessing(false);
    success(
      `Importación completada: ${totals.inserted} insertados, ${totals.updated} actualizados, ${totals.skipped} omitidos.`,
      "Importación exitosa",
    );
    setTimeout(() => resetState(), 3000);
  };

  // Computed values
  const totalRows = uploadedFiles.reduce((sum, f) => sum + f.rowCount, 0);
  const isValidMapping =
    firstFile && currentTable ? isValidColumnMapping(currentTable, firstFile.columnMapping) : false;
  const hasPreviewData = uploadedFiles.some((f) => f.previewData);
  const hasErrors = uploadedFiles.some((f) =>
    f.previewData?.errors ? f.previewData.errors.length > 0 : false,
  );

  const columns = buildMappingColumns({
    firstFile,
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
      {/* 1. Select Table */}
      <TableSelectionCard
        allowedTableOptions={allowedTableOptions}
        currentTable={currentTable}
        onTableChange={handleTableChange}
        selectedTable={selectedTable}
      />

      {/* 2. Upload Files */}
      <FileUploadSection
        disabled={isProcessing}
        onFileChange={handleFileChange}
        selectedTable={selectedTable}
      />

      {/* 3. Files List */}
      <FilesListSection onRemove={handleRemoveFile} uploadedFiles={uploadedFiles} />

      {/* 4. Map Columns (showing first file's mapping) */}
      {firstFile && currentTable && (
        <ColumnMappingCard columns={columns} fields={currentTable.fields} totalRows={totalRows} />
      )}

      {/* 5. Preview Summary */}
      <ImportSummaryCard uploadedFiles={uploadedFiles} />

      {/* 6. Actions */}
      {uploadedFiles.length > 0 && (
        <div className="sticky bottom-0 z-10 -mx-4 flex justify-end gap-3 border-default-100 border-t bg-background/80 p-4 shadow-lg backdrop-blur-md sm:mx-0 sm:rounded-xl sm:border">
          <Button
            disabled={!isValidMapping || isProcessing || uploadedFiles.length === 0}
            onClick={handlePreview}
            variant="secondary"
          >
            {isProcessing ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <FileUp className="mr-2 h-4 w-4" />
            )}
            {hasPreviewData ? "Recalcular vista previa" : "Generar vista previa"}
          </Button>

          <Button
            disabled={
              !hasPreviewData ||
              !isValidMapping ||
              isProcessing ||
              uploadedFiles.length === 0 ||
              hasErrors
            }
            onClick={handleImport}
          >
            {isProcessing ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle className="mr-2 h-4 w-4" />
            )}
            Confirmar Importación
          </Button>
        </div>
      )}
    </div>
  );
}
