import { useMutation } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { AlertCircle, ArrowRight, CheckCircle, FileUp, Loader2, Lock, Upload } from "lucide-react";
import Papa from "papaparse";
import { useState } from "react";

import { DataTable } from "@/components/data-table/DataTable";
import Alert from "@/components/ui/Alert";
import Button from "@/components/ui/Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import FileInput from "@/components/ui/FileInput";
import Input from "@/components/ui/Input";
import { useAuth } from "@/context/AuthContext";
import { type CsvImportPayload, importCsvData, previewCsvImport } from "@/features/data-import/api";
import { PAGE_CONTAINER } from "@/lib/styles";
import { cn } from "@/lib/utils";

interface TableOption {
  fields: { name: string; required: boolean; type: string }[];
  label: string;
  value: string;
}

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
    label: "Balances de producción diaria",
    value: "daily_production_balances",
  },
  {
    fields: [
      { name: "name", required: true, type: "string" },
      { name: "rut", required: false, type: "string" },
      { name: "type", required: false, type: "enum" },
      { name: "frequency", required: false, type: "enum" },
      { name: "defaultAmount", required: false, type: "number" },
      { name: "status", required: false, type: "enum" },
    ],
    label: "Servicios",
    value: "services",
  },
  {
    fields: [
      { name: "categoryId", required: false, type: "number" },
      { name: "name", required: true, type: "string" },
      { name: "description", required: false, type: "string" },
      { name: "currentStock", required: false, type: "number" },
    ],
    label: "Ítems de inventario",
    value: "inventory_items",
  },
  {
    fields: [
      { name: "rut", required: true, type: "string" },
      { name: "workDate", required: true, type: "date" },
      { name: "startTime", required: false, type: "time" },
      { name: "endTime", required: false, type: "time" },
      { name: "workedMinutes", required: true, type: "number" },
      { name: "overtimeMinutes", required: false, type: "number" },
      { name: "comment", required: false, type: "string" },
    ],
    label: "Horas trabajadas",
    value: "employee_timesheets",
  },
];

// Backend now supports all these tables
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
]);

// Permission mapping
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
};

interface FieldDefinition {
  name: string;
  required: boolean;
  type: string;
}

export default function CSVUploadPage() {
  const { can } = useAuth();
  const [selectedTable, setSelectedTable] = useState<string>("");
  const [csvData, setCsvData] = useState<Record<string, string>[]>([]);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});

  // Parsed status
  const [parseStatus, setParseStatus] = useState<"error" | "idle" | "parsing">("idle");
  const [errorMessage, setErrorMessage] = useState<string>("");

  const [previewData, setPreviewData] = useState<null | {
    errors?: string[];
    inserted?: number;
    skipped?: number;
    toInsert?: number;
    toSkip?: number;
    toUpdate?: number;
    updated?: number;
  }>(null);

  const [showSuccessMessage, setShowSuccessMessage] = useState(false);

  const allowedTableOptions = TABLE_OPTIONS.filter((t) => {
    // 1. Must be supported by backend
    if (!SUPPORTED_TABLES.has(t.value)) return false;
    // 2. Must have permission
    const perm = PERMISSION_MAP[t.value];
    if (!perm) return false;
    return can(perm.action, perm.subject);
  });

  const currentTable = allowedTableOptions.find((t) => t.value === selectedTable);

  // Mutations
  const {
    isError: isPreviewError,
    isPending: isPreviewPending,
    mutate: previewMutate,
  } = useMutation({
    mutationFn: (payload: CsvImportPayload) => previewCsvImport(payload),
    onError: (err) => {
      setErrorMessage(err instanceof Error ? err.message : "Error al previsualizar datos");
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
      setErrorMessage(err instanceof Error ? err.message : "Error al importar datos");
    },
    onSuccess: (data) => {
      setPreviewData(data);
      setShowSuccessMessage(true);

      // Reset after delay
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

  const resetState = () => {
    setCsvData([]);
    setCsvHeaders([]);
    setColumnMapping({});
    setPreviewData(null);
    setParseStatus("idle");
    setErrorMessage("");
    setShowSuccessMessage(false);
  };

  const handleTableChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedTable(e.target.value);
    resetState();
  };

  const handleParseComplete = (results: Papa.ParseResult<Record<string, string>>) => {
    if (results.errors.length > 0) {
      setParseStatus("error");
      setErrorMessage(`Error al parsear CSV: ${results.errors[0]?.message || "Error desconocido"}`);
      return;
    }

    const headers = results.meta.fields || [];
    setCsvHeaders(headers);
    setCsvData(results.data);

    // Auto-mapping heuristics
    if (currentTable) {
      const autoMapping: Record<string, string> = {};
      for (const field of currentTable.fields) {
        const matchingHeader = headers.find(
          (h) =>
            h.toLowerCase() === field.name.toLowerCase() ||
            h.toLowerCase().replaceAll("_", "") === field.name.toLowerCase()
        );
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
    if (!file) return;

    setParseStatus("parsing");
    setErrorMessage("");
    setShowSuccessMessage(false);
    setPreviewData(null);

    Papa.parse(file, {
      complete: handleParseComplete,
      error: (error) => {
        setParseStatus("error");
        setErrorMessage(`Error al leer archivo: ${error.message}`);
      },
      header: true,
      skipEmptyLines: true,
    });
  };

  const handleColumnMapChange = (dbField: string, csvColumn: string) => {
    setColumnMapping((prev) => ({
      ...prev,
      [dbField]: csvColumn,
    }));
  };

  const getTransformedData = () => {
    return csvData.map((row) => {
      const transformed: Record<string, number | string> = {};
      for (const [dbField, csvColumn] of Object.entries(columnMapping)) {
        if (csvColumn && row[csvColumn] !== undefined) {
          transformed[dbField] = row[csvColumn];
        }
      }
      return transformed;
    });
  };

  const handlePreview = () => {
    if (!selectedTable || csvData.length === 0) return;
    setErrorMessage("");
    previewMutate({
      data: getTransformedData(),
      table: selectedTable,
    });
  };

  const handleImport = () => {
    if (!selectedTable || csvData.length === 0) return;
    setErrorMessage("");
    importMutate({
      data: getTransformedData(),
      table: selectedTable,
    });
  };

  const isValidMapping = (() => {
    if (!currentTable) return false;
    const requiredFields = currentTable.fields.filter((f) => f.required);
    return requiredFields.every((field) => columnMapping[field.name] && columnMapping[field.name] !== "");
  })();

  const columns: ColumnDef<FieldDefinition>[] = [
    {
      accessorKey: "name",
      cell: ({ row }) => (
        <div className="flex items-center gap-1.5 font-medium">
          {row.original.name}
          {row.original.required && (
            <span className="text-error text-xs" title="Requerido">
              *
            </span>
          )}
        </div>
      ),
      header: "Campo BD",
    },
    {
      accessorKey: "type",
      cell: ({ row }) => <span className="badge badge-xs badge-ghost font-mono">{row.original.type}</span>,
      header: "Tipo",
    },
    {
      cell: ({ row }) => (
        <Input
          as="select"
          className={cn(
            "w-full max-w-xs transition-colors",
            row.original.required && !columnMapping[row.original.name]
              ? "border-error focus:border-error text-error"
              : ""
          )}
          onChange={(e) => {
            handleColumnMapChange(row.original.name, e.target.value);
          }}
          size="sm"
          value={columnMapping[row.original.name] || ""}
        >
          <option value="">-- Ignorar / Sin mapear --</option>
          {csvHeaders.map((header) => (
            <option key={`${row.original.name}-${header}`} value={header}>
              {header}
            </option>
          ))}
        </Input>
      ),
      header: "Columna CSV",
      id: "mapping",
    },
    {
      cell: ({ row }) => {
        const mappedColumn = columnMapping[row.original.name];
        return (
          <span className="text-base-content/60 max-w-37.5 truncate font-mono text-xs">
            {(mappedColumn && csvData[0]?.[mappedColumn]) || "-"}
          </span>
        );
      },
      header: "Ejemplo (Fila 1)",
      id: "preview",
    },
  ];

  return (
    <div className={PAGE_CONTAINER}>
      {/* Access Denied State */}
      {allowedTableOptions.length === 0 ? (
        <Alert variant="warning">
          <Lock className="h-4 w-4" />
          <div className="flex flex-col">
            <span className="font-bold">Acceso restringido</span>
            <span>No tienes permisos para importar datos en ninguna tabla disponible.</span>
          </div>
        </Alert>
      ) : (
        <>
          {/* Selector de tabla */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileUp className="text-primary h-5 w-5" />
                1. Seleccionar destino
              </CardTitle>
              <CardDescription>Elige la tabla donde deseas importar los datos.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                <div className="w-full sm:w-1/3">
                  <Input as="select" className="w-full" onChange={handleTableChange} value={selectedTable}>
                    <option value="">-- Seleccionar tabla --</option>
                    {allowedTableOptions.map((table) => (
                      <option key={table.value} value={table.value}>
                        {table.label}
                      </option>
                    ))}
                  </Input>
                </div>

                {currentTable && (
                  <div className="bg-base-200/50 flex-1 rounded-lg p-4">
                    <h3 className="mb-2 text-xs font-bold tracking-wide uppercase opacity-70">Campos requeridos</h3>
                    <div className="flex flex-wrap gap-2">
                      {currentTable.fields.map((field) => (
                        <span
                          className={cn("badge badge-sm", field.required ? "badge-primary" : "badge-ghost opacity-60")}
                          key={field.name}
                        >
                          {field.name}
                          {field.required && "*"}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Subida de archivo */}
          {selectedTable && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">2. Cargar archivo</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <FileInput
                  accept=".csv"
                  disabled={parseStatus === "parsing" || isPreviewPending || isImportPending}
                  label="Arrastra un archivo CSV aquí o haz clic para seleccionar"
                  onChange={handleFileChange}
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
                          {previewData.inserted || 0} insertados · {previewData.updated || 0} actualizados ·{" "}
                          {previewData.skipped || 0} omitidos
                        </span>
                      )}
                    </div>
                  </Alert>
                )}
              </CardContent>
            </Card>
          )}

          {/* Mapeo de columnas */}
          {csvHeaders.length > 0 && currentTable && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">3. Mapeo de columnas</CardTitle>
                <CardDescription>
                  Relaciona las columnas de tu CSV con los campos de la base de datos.
                  <br />
                  <span className="text-xs opacity-70">Detectadas {csvData.length} filas.</span>
                </CardDescription>
              </CardHeader>
              <div className="border-t">
                <DataTable columns={columns} data={currentTable.fields} />
              </div>
            </Card>
          )}

          {/* Vista previa */}
          {previewData && !showSuccessMessage && (
            <Card className="border-primary/20 bg-primary/5">
              <CardContent className="p-6">
                <h3 className="mb-4 text-lg font-semibold">Resumen de Importación</h3>
                <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
                  <div className="bg-base-100 border-base-200 rounded-lg border p-3 shadow-sm">
                    <div className="mb-1 text-xs tracking-wider uppercase opacity-70">Insertar</div>
                    <div className="text-success text-2xl font-bold">{previewData.toInsert || 0}</div>
                  </div>
                  <div className="bg-base-100 border-base-200 rounded-lg border p-3 shadow-sm">
                    <div className="mb-1 text-xs tracking-wider uppercase opacity-70">Actualizar</div>
                    <div className="text-info text-2xl font-bold">{previewData.toUpdate || 0}</div>
                  </div>
                  <div className="bg-base-100 border-base-200 rounded-lg border p-3 shadow-sm">
                    <div className="mb-1 text-xs tracking-wider uppercase opacity-70">Omitir</div>
                    <div className="text-warning text-2xl font-bold">{previewData.toSkip || 0}</div>
                  </div>
                </div>

                {previewData.errors && previewData.errors.length > 0 && (
                  <Alert className="mb-0" variant="warning">
                    <div className="flex w-full flex-col gap-2">
                      <div className="flex items-center gap-2 font-medium">
                        <AlertCircle className="h-4 w-4" />
                        Errores de validación ({previewData.errors.length})
                      </div>
                      <ul className="bg-base-100/50 max-h-32 list-inside list-disc overflow-y-auto rounded p-2 text-xs opacity-90">
                        {previewData.errors.map((err, i) => (
                          <li key={i}>{err}</li>
                        ))}
                      </ul>
                    </div>
                  </Alert>
                )}
              </CardContent>
            </Card>
          )}

          {/* Acciones */}
          {csvData.length > 0 && (
            <div className="bg-base-100/80 border-base-200 sticky bottom-0 z-10 -mx-4 flex justify-end gap-3 border-t p-4 shadow-lg backdrop-blur-md sm:mx-0 sm:rounded-xl sm:border">
              <Button
                disabled={!isValidMapping || isPreviewPending || isImportPending}
                onClick={handlePreview}
                variant="outline"
              >
                {isPreviewPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="mr-2 h-4 w-4" />
                )}
                Visualizar cambios
              </Button>

              <Button
                disabled={!isValidMapping || isPreviewPending || isImportPending}
                onClick={handleImport}
                variant="primary"
              >
                {isImportPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <ArrowRight className="mr-2 h-4 w-4" />
                )}
                Confirmar Importación
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
