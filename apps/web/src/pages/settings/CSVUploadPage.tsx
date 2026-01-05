import { useMutation } from "@tanstack/react-query";
import { AlertCircle, ArrowRight, CheckCircle, FileUp, Loader2, Lock, Upload } from "lucide-react";
import Papa from "papaparse";
import { useState } from "react";

import Alert from "@/components/ui/Alert";
import Button from "@/components/ui/Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import FileInput from "@/components/ui/FileInput";
import Input from "@/components/ui/Input";
import { Table, TableBody, TableHeader } from "@/components/ui/Table";
import { useAuth } from "@/context/AuthContext";
import { type CsvImportPayload, importCsvData, previewCsvImport } from "@/features/data-import/api";
import { PAGE_CONTAINER } from "@/lib/styles";
import { cn } from "@/lib/utils";

type TableOption = {
  value: string;
  label: string;
  fields: { name: string; type: string; required: boolean }[];
};

const TABLE_OPTIONS: TableOption[] = [
  {
    value: "people",
    label: "Personas",
    fields: [
      { name: "rut", type: "string", required: true },
      { name: "names", type: "string", required: true },
      { name: "fatherName", type: "string", required: false },
      { name: "motherName", type: "string", required: false },
      { name: "email", type: "string", required: false },
      { name: "phone", type: "string", required: false },
      { name: "address", type: "string", required: false },
      { name: "personType", type: "enum", required: false },
    ],
  },
  {
    value: "employees",
    label: "Trabajadores",
    fields: [
      { name: "rut", type: "string", required: true },
      { name: "position", type: "string", required: true },
      { name: "department", type: "string", required: false },
      { name: "startDate", type: "date", required: true },
      { name: "endDate", type: "date", required: false },
      { name: "status", type: "enum", required: false },
      { name: "salaryType", type: "enum", required: false },
      { name: "baseSalary", type: "number", required: false },
      { name: "hourlyRate", type: "number", required: false },
      { name: "overtimeRate", type: "number", required: false },
      { name: "retentionRate", type: "number", required: false },
      { name: "bankName", type: "string", required: false },
      { name: "bankAccountType", type: "string", required: false },
      { name: "bankAccountNumber", type: "string", required: false },
    ],
  },
  {
    value: "counterparts",
    label: "Contrapartes",
    fields: [
      { name: "rut", type: "string", required: true },
      { name: "category", type: "enum", required: false },
      { name: "notes", type: "string", required: false },
    ],
  },
  {
    value: "transactions",
    label: "Transacciones",
    fields: [
      { name: "timestamp", type: "datetime", required: true },
      { name: "description", type: "string", required: false },
      { name: "amount", type: "number", required: true },
      { name: "direction", type: "enum", required: true },
      { name: "rut", type: "string", required: false },
      { name: "origin", type: "string", required: false },
      { name: "destination", type: "string", required: false },
      { name: "category", type: "string", required: false },
    ],
  },
  {
    value: "daily_balances",
    label: "Saldos diarios",
    fields: [
      { name: "date", type: "date", required: true },
      { name: "amount", type: "number", required: true },
      { name: "note", type: "string", required: false },
    ],
  },
  {
    value: "daily_production_balances",
    label: "Balances de producción diaria",
    fields: [
      { name: "balanceDate", type: "date", required: true },
      { name: "ingresoTarjetas", type: "number", required: false },
      { name: "ingresoTransferencias", type: "number", required: false },
      { name: "ingresoEfectivo", type: "number", required: false },
      { name: "gastosDiarios", type: "number", required: false },
      { name: "otrosAbonos", type: "number", required: false },
      { name: "consultasMonto", type: "number", required: false },
      { name: "controlesMonto", type: "number", required: false },
      { name: "testsMonto", type: "number", required: false },
      { name: "vacunasMonto", type: "number", required: false },
      { name: "licenciasMonto", type: "number", required: false },
      { name: "roxairMonto", type: "number", required: false },
      { name: "comentarios", type: "string", required: false },
      { name: "status", type: "enum", required: false },
      { name: "changeReason", type: "string", required: false },
    ],
  },
  {
    value: "services",
    label: "Servicios",
    fields: [
      { name: "name", type: "string", required: true },
      { name: "rut", type: "string", required: false },
      { name: "type", type: "enum", required: false },
      { name: "frequency", type: "enum", required: false },
      { name: "defaultAmount", type: "number", required: false },
      { name: "status", type: "enum", required: false },
    ],
  },
  {
    value: "inventory_items",
    label: "Ítems de inventario",
    fields: [
      { name: "categoryId", type: "number", required: false },
      { name: "name", type: "string", required: true },
      { name: "description", type: "string", required: false },
      { name: "currentStock", type: "number", required: false },
    ],
  },
  {
    value: "employee_timesheets",
    label: "Horas trabajadas",
    fields: [
      { name: "rut", type: "string", required: true },
      { name: "workDate", type: "date", required: true },
      { name: "startTime", type: "time", required: false },
      { name: "endTime", type: "time", required: false },
      { name: "workedMinutes", type: "number", required: true },
      { name: "overtimeMinutes", type: "number", required: false },
      { name: "comment", type: "string", required: false },
    ],
  },
];

// Backend only supports these tables
const SUPPORTED_TABLES = ["people", "employees", "counterparts", "daily_balances", "transactions"];

// Permission mapping
const PERMISSION_MAP: Record<string, { action: string; subject: string }> = {
  people: { action: "create", subject: "Person" },
  employees: { action: "create", subject: "Employee" },
  counterparts: { action: "create", subject: "Counterpart" },
  daily_balances: { action: "create", subject: "Balance" },
  transactions: { action: "create", subject: "Transaction" },
};

export default function CSVUploadPage() {
  const { can } = useAuth();
  const [selectedTable, setSelectedTable] = useState<string>("");
  const [csvData, setCsvData] = useState<Record<string, string>[]>([]);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});

  // Parsed status
  const [parseStatus, setParseStatus] = useState<"idle" | "parsing" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string>("");

  const [previewData, setPreviewData] = useState<{
    toInsert?: number;
    toUpdate?: number;
    toSkip?: number;
    inserted?: number;
    updated?: number;
    skipped?: number;
    errors?: string[];
  } | null>(null);

  const [showSuccessMessage, setShowSuccessMessage] = useState(false);

  const allowedTableOptions = TABLE_OPTIONS.filter((t) => {
    // 1. Must be supported by backend
    if (!SUPPORTED_TABLES.includes(t.value)) return false;
    // 2. Must have permission
    const perm = PERMISSION_MAP[t.value];
    if (!perm) return false;
    return can(perm.action, perm.subject);
  });

  const currentTable = allowedTableOptions.find((t) => t.value === selectedTable);

  // Mutations
  const {
    mutate: previewMutate,
    isPending: isPreviewPending,
    isError: isPreviewError,
  } = useMutation({
    mutationFn: (payload: CsvImportPayload) => previewCsvImport(payload),
    onSuccess: (data) => {
      setPreviewData(data);
    },
    onError: (err) => {
      setErrorMessage(err instanceof Error ? err.message : "Error al previsualizar datos");
    },
  });

  const {
    mutate: importMutate,
    isPending: isImportPending,
    isError: isImportError,
  } = useMutation({
    mutationFn: (payload: CsvImportPayload) => importCsvData(payload),
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
    onError: (err) => {
      setErrorMessage(err instanceof Error ? err.message : "Error al importar datos");
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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement> | File) => {
    const file = e instanceof File ? e : e.target.files?.[0];
    if (!file) return;

    setParseStatus("parsing");
    setErrorMessage("");
    setShowSuccessMessage(false);
    setPreviewData(null);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        if (results.errors.length > 0) {
          setParseStatus("error");
          setErrorMessage(`Error al parsear CSV: ${results.errors[0]?.message || "Error desconocido"}`);
          return;
        }

        const headers = results.meta.fields || [];
        setCsvHeaders(headers);
        setCsvData(results.data as Record<string, string>[]);

        // Auto-mapping heuristics
        if (currentTable) {
          const autoMapping: Record<string, string> = {};
          currentTable.fields.forEach((field) => {
            const matchingHeader = headers.find(
              (h) =>
                h.toLowerCase() === field.name.toLowerCase() ||
                h.toLowerCase().replace(/_/g, "") === field.name.toLowerCase()
            );
            if (matchingHeader) {
              autoMapping[field.name] = matchingHeader;
            }
          });
          setColumnMapping(autoMapping);
        }

        setParseStatus("idle");
      },
      error: (error) => {
        setParseStatus("error");
        setErrorMessage(`Error al leer archivo: ${error.message}`);
      },
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
      const transformed: Record<string, string | number> = {};
      Object.entries(columnMapping).forEach(([dbField, csvColumn]) => {
        if (csvColumn && row[csvColumn] !== undefined) {
          transformed[dbField] = row[csvColumn];
        }
      });
      return transformed;
    });
  };

  const handlePreview = () => {
    if (!selectedTable || csvData.length === 0) return;
    setErrorMessage("");
    previewMutate({
      table: selectedTable,
      data: getTransformedData(),
    });
  };

  const handleImport = () => {
    if (!selectedTable || csvData.length === 0) return;
    setErrorMessage("");
    importMutate({
      table: selectedTable,
      data: getTransformedData(),
    });
  };

  const isValidMapping = (() => {
    if (!currentTable) return false;
    const requiredFields = currentTable.fields.filter((f) => f.required);
    return requiredFields.every((field) => columnMapping[field.name] && columnMapping[field.name] !== "");
  })();

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
                  <Input as="select" value={selectedTable} onChange={handleTableChange} className="w-full">
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
                          key={field.name}
                          className={cn("badge badge-sm", field.required ? "badge-primary" : "badge-ghost opacity-60")}
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
                  onChange={handleFileChange}
                  disabled={parseStatus === "parsing" || isPreviewPending || isImportPending}
                  label="Arrastra un archivo CSV aquí o haz clic para seleccionar"
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
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table
                    columns={[
                      { key: "dbField", label: "Campo BD" },
                      { key: "type", label: "Tipo" },
                      { key: "csvColumn", label: "Columna CSV" },
                      { key: "preview", label: "Ejemplo (Fila 1)" },
                    ]}
                  >
                    <TableHeader
                      columns={[
                        { key: "dbField", label: "Campo BD", width: "25%" },
                        { key: "type", label: "Tipo", width: "15%" },
                        { key: "csvColumn", label: "Columna CSV", width: "35%" },
                        { key: "preview", label: "Ejemplo (Fila 1)", width: "25%" },
                      ]}
                    />
                    <TableBody columnsCount={4}>
                      {currentTable.fields.map((field) => (
                        <tr key={field.name} className="hover:bg-base-200/30">
                          <td className="pl-6 font-medium">
                            <div className="flex items-center gap-1.5">
                              {field.name}
                              {field.required && (
                                <span className="text-error text-xs" title="Requerido">
                                  *
                                </span>
                              )}
                            </div>
                          </td>
                          <td>
                            <span className="badge badge-xs badge-ghost font-mono">{field.type}</span>
                          </td>
                          <td>
                            <Input
                              as="select"
                              size="sm"
                              className={cn(
                                "w-full max-w-xs transition-colors",
                                field.required && !columnMapping[field.name]
                                  ? "border-error focus:border-error text-error"
                                  : ""
                              )}
                              value={columnMapping[field.name] || ""}
                              onChange={(e) => handleColumnMapChange(field.name, e.target.value)}
                            >
                              <option value="">-- Ignorar / Sin mapear --</option>
                              {csvHeaders.map((header) => (
                                <option key={`${field.name}-${header}`} value={header}>
                                  {header}
                                </option>
                              ))}
                            </Input>
                          </td>
                          <td className="text-base-content/60 max-w-37.5 truncate font-mono text-xs">
                            {(() => {
                              const mappedColumn = columnMapping[field.name];
                              return (mappedColumn && csvData[0]?.[mappedColumn]) || "-";
                            })()}
                          </td>
                        </tr>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
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
                  <Alert variant="warning" className="mb-0">
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
                variant="outline"
                onClick={handlePreview}
                disabled={!isValidMapping || isPreviewPending || isImportPending}
              >
                {isPreviewPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="mr-2 h-4 w-4" />
                )}
                Visualizar cambios
              </Button>

              <Button
                variant="primary"
                onClick={handleImport}
                disabled={!isValidMapping || isPreviewPending || isImportPending}
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
