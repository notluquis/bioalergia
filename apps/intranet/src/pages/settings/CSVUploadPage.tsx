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
import { type CsvImportPayload, importCsvData, previewCsvImport } from "@/features/data-import/api";
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

const HEADER_ALIAS_REGEX = /\(([^)]+)\)/;
const normalizeKey = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, "");

const extractHeaderAliases = (header: string) => {
  const match = header.match(HEADER_ALIAS_REGEX);
  const aliases = [header];
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
];

const SUPPORTED_TABLES = new Set([
  "counterparts",
  "daily_balances",
  "daily_production_balances",
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

interface ImportPreviewData {
  errors?: string[];
  inserted?: number;
  skipped?: number;
  toInsert?: number;
  toSkip?: number;
  toUpdate?: number;
  updated?: number;
}

function FileImportCard({
  errorMessage,
  isImportError,
  isImportPending,
  isPreviewError,
  isPreviewPending,
  onFileChange,
  parseStatus,
  previewData,
  showSuccessMessage,
}: {
  errorMessage: string;
  isImportError: boolean;
  isImportPending: boolean;
  isPreviewError: boolean;
  isPreviewPending: boolean;
  onFileChange: (e: File | React.ChangeEvent<HTMLInputElement>) => void;
  parseStatus: "error" | "idle" | "parsing";
  previewData: ImportPreviewData | null;
  showSuccessMessage: boolean;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">2. Cargar archivo</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <FileInput
          accept=".csv"
          disabled={parseStatus === "parsing" || isPreviewPending || isImportPending}
          label="Arrastra un archivo CSV aquí o haz clic para seleccionar"
          onChange={onFileChange}
        />

        {parseStatus === "parsing" && (
          <Alert>
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Procesando archivo...</span>
          </Alert>
        )}

        {parseStatus === "error" && (
          <Alert variant="error">
            <AlertCircle className="h-4 w-4" />
            <span>{errorMessage}</span>
          </Alert>
        )}

        {(isPreviewError || isImportError) && errorMessage && (
          <Alert variant="error">
            <AlertCircle className="h-4 w-4" />
            <span>{errorMessage}</span>
          </Alert>
        )}

        {showSuccessMessage && (
          <Alert variant="success">
            <CheckCircle className="h-4 w-4" />
            <div className="flex flex-col gap-1">
              <span className="font-medium">Importación completada</span>
              {previewData && (
                <span className="text-xs opacity-90">
                  {previewData.inserted ?? 0} insertados · {previewData.updated ?? 0} actualizados ·{" "}
                  {previewData.skipped ?? 0} omitidos
                </span>
              )}
            </div>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}

function ColumnMappingCard({
  columns,
  csvDataLength,
  fields,
}: {
  columns: ColumnDef<FieldDefinition>[];
  csvDataLength: number;
  fields: FieldDefinition[];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">3. Mapeo de columnas</CardTitle>
        <CardDescription>
          Relaciona las columnas de tu CSV con los campos de la base de datos.
          <br />
          <span className="text-xs opacity-70">Detectadas {csvDataLength} filas.</span>
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

function ImportSummaryCard({ previewData }: { previewData: ImportPreviewData }) {
  if (!previewData) {
    return null;
  }

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardContent className="p-6">
        <h3 className="mb-4 font-semibold text-lg">Resumen de Importación</h3>
        <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
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

        {previewData.errors && previewData.errors.length > 0 && (
          <Alert className="mb-0" variant="warning">
            <div className="flex w-full flex-col gap-2">
              <div className="flex items-center gap-2 font-medium">
                <AlertCircle className="h-4 w-4" />
                Errores de validación ({previewData.errors.length})
              </div>
              <ul className="max-h-32 list-inside list-disc overflow-y-auto rounded bg-background/50 p-2 text-xs opacity-90">
                {previewData.errors.map((err: string, i: number) => (
                  <li key={`${i}-${err.substring(0, 20)}`}>{err}</li>
                ))}
              </ul>
            </div>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}

function buildMappingColumns({
  columnMapping,
  csvData,
  csvHeaders,
  setColumnMapping,
}: {
  columnMapping: Record<string, string>;
  csvData: Record<string, string>[];
  csvHeaders: string[];
  setColumnMapping: React.Dispatch<React.SetStateAction<Record<string, string>>>;
}): ColumnDef<FieldDefinition>[] {
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
            setColumnMapping((prev) => ({
              ...prev,
              [row.original.name]: val as string,
            }));
          }}
          value={columnMapping[row.original.name] ?? ""}
        >
          <SelectItem id="" key="">
            -- Ignorar / Sin mapear --
          </SelectItem>
          {csvHeaders.map((header) => (
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
        const mappedColumn = columnMapping[row.original.name];
        return (
          <span className="max-w-37.5 truncate font-mono text-default-500 text-xs">
            {(mappedColumn && csvData[0]?.[mappedColumn]) ?? "-"}
          </span>
        );
      },
      header: "Ejemplo (Fila 1)",
      id: "preview",
    },
  ];
}

// --- Main Page Component ---
export function CSVUploadPage() {
  const { can } = useAuth();
  const { error: showError, success } = useToast();
  const [selectedTable, setSelectedTable] = useState<string>("");
  const [csvData, setCsvData] = useState<Record<string, string>[]>([]);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});

  // Parsed status
  const [parseStatus, setParseStatus] = useState<"error" | "idle" | "parsing">("idle");
  const [errorMessage, setErrorMessage] = useState<string>("");

  const [previewData, setPreviewData] = useState<null | ImportPreviewData>(null);

  const [showSuccessMessage, setShowSuccessMessage] = useState(false);

  // Computed
  const allowedTableOptions = getAllowedTableOptions(can);

  const currentTable = allowedTableOptions.find((t) => t.value === selectedTable);

  // Mutations
  const {
    isError: isPreviewError,
    isPending: isPreviewPending,
    mutate: previewMutate,
  } = useMutation({
    mutationFn: (payload: CsvImportPayload) => previewCsvImport(payload),
    onError: (err) => {
      const message = err instanceof Error ? err.message : "Error al previsualizar datos";
      setErrorMessage(message);
      showError(message, "Previsualización fallida");
    },
    onSuccess: (data) => {
      setPreviewData(data);
    },
  });

  const {
    isError: isImportError,
    isPending: isImportPending,
    mutate: importMutate,
  } = useMutation({
    mutationFn: (payload: CsvImportPayload) => importCsvData(payload),
    onError: (err) => {
      const message = err instanceof Error ? err.message : "Error al importar datos";
      setErrorMessage(message);
      showError(message, "Importación fallida");
    },
    onSuccess: (data) => {
      const inserted = data.inserted ?? 0;
      const updated = data.updated ?? 0;
      const skipped = data.skipped ?? 0;
      success(
        `Importación completada: ${inserted} insertados, ${updated} actualizados, ${skipped} omitidos.`,
        "Importación exitosa",
      );
      setPreviewData(data);
      setShowSuccessMessage(true);
      setTimeout(() => {
        setShowSuccessMessage(false);
        setCsvData([]);
        setCsvHeaders([]);
        setColumnMapping({});
        setPreviewData(null);
        setParseStatus("idle");
      }, 3000);
    },
  });

  // Handlers
  const resetState = () => {
    setCsvData([]);
    setCsvHeaders([]);
    setColumnMapping({});
    setPreviewData(null);
    setParseStatus("idle");
    setErrorMessage("");
    setShowSuccessMessage(false);
  };

  const handleTableChange = (value: string) => {
    setSelectedTable(value);
    resetState();
  };

  const handleParseComplete = (results: Papa.ParseResult<Record<string, string>>) => {
    if (results.errors.length > 0) {
      setParseStatus("error");
      setErrorMessage(`Error al parsear CSV: ${results.errors[0]?.message ?? "Error desconocido"}`);
      return;
    }

    const headers = results.meta.fields ?? [];
    setCsvHeaders(headers);
    setCsvData(results.data);

    if (currentTable) {
      const autoMapping: Record<string, string> = {};
      for (const field of currentTable.fields) {
        const matchingHeader = matchHeaderForField(field.name, headers);
        if (matchingHeader) {
          autoMapping[field.name] = matchingHeader;
        }
      }
      setColumnMapping(autoMapping);
    }
    setParseStatus("idle");
  };

  const handleFileChange = (e: File | React.ChangeEvent<HTMLInputElement>) => {
    const file = e instanceof File ? e : e.target.files?.[0];
    if (!file) {
      return;
    }

    setParseStatus("parsing");
    setErrorMessage("");
    setShowSuccessMessage(false);
    setPreviewData(null);

    Papa.parse(file, {
      complete: handleParseComplete,
      delimitersToGuess: [",", ";", "\t", "|"],
      error: (error) => {
        setParseStatus("error");
        setErrorMessage(`Error al leer archivo: ${error.message}`);
      },
      header: true,
      skipEmptyLines: true,
    });
  };

  const handlePreview = () => {
    if (!selectedTable || csvData.length === 0) {
      return;
    }
    setErrorMessage("");
    previewMutate({
      data: selectedData,
      table: selectedTable,
    });
  };

  const handleImport = () => {
    if (!selectedTable || csvData.length === 0) {
      return;
    }
    setErrorMessage("");
    importMutate({
      data: selectedData,
      table: selectedTable,
    });
  };

  const selectedData = buildTransformedData(csvData, columnMapping);
  const isValidMapping = isValidColumnMapping(currentTable, columnMapping);

  const columns = buildMappingColumns({
    columnMapping,
    csvData,
    csvHeaders,
    setColumnMapping,
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

      {/* 2. Upload File */}
      {selectedTable && (
        <FileImportCard
          errorMessage={errorMessage}
          isImportError={isImportError}
          isImportPending={isImportPending}
          isPreviewError={isPreviewError}
          isPreviewPending={isPreviewPending}
          onFileChange={handleFileChange}
          parseStatus={parseStatus}
          previewData={previewData}
          showSuccessMessage={showSuccessMessage}
        />
      )}

      {/* 3. Map Columns */}
      {csvHeaders.length > 0 && currentTable && (
        <ColumnMappingCard
          columns={columns}
          csvDataLength={csvData.length}
          fields={currentTable.fields}
        />
      )}

      {/* 4. Preview & Import Actions */}
      {csvHeaders.length > 0 && currentTable && !showSuccessMessage && (
        <>
          {previewData && <ImportSummaryCard previewData={previewData} />}

          {/* Action Buttons */}
          <div className="sticky bottom-0 z-10 -mx-4 flex justify-end gap-3 border-default-100 border-t bg-background/80 p-4 shadow-lg backdrop-blur-md sm:mx-0 sm:rounded-xl sm:border">
            <Button
              disabled={
                !isValidMapping || isPreviewPending || isImportPending || selectedData.length === 0
              }
              onClick={handlePreview}
              variant="secondary"
            >
              {isPreviewPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <FileUp className="mr-2 h-4 w-4" />
              )}
              {previewData ? "Recalcular vista previa" : "Generar vista previa"}
            </Button>

            <Button
              disabled={
                !previewData ||
                !isValidMapping ||
                isPreviewPending ||
                isImportPending ||
                selectedData.length === 0 ||
                (previewData.errors && previewData.errors.length > 0)
              }
              onClick={handleImport}
            >
              {isImportPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle className="mr-2 h-4 w-4" />
              )}
              Confirmar Importación
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
