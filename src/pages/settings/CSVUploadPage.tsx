import { useState } from "react";
import Papa from "papaparse";
import { Upload, CheckCircle, AlertCircle, ArrowRight } from "lucide-react";
import Input from "@/components/ui/Input";
import FileInput from "@/components/ui/FileInput";
import Button from "@/components/ui/Button";

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

export default function CSVUploadPage() {
  const [selectedTable, setSelectedTable] = useState<string>("");
  const [csvData, setCsvData] = useState<Record<string, string>[]>([]);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});
  const [uploadStatus, setUploadStatus] = useState<"idle" | "parsing" | "ready" | "uploading" | "success" | "error">(
    "idle"
  );
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

  const currentTable = TABLE_OPTIONS.find((t) => t.value === selectedTable);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadStatus("parsing");
    setErrorMessage("");

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        if (results.errors.length > 0) {
          setUploadStatus("error");
          setErrorMessage(`Error al parsear CSV: ${results.errors[0]?.message || "Error desconocido"}`);
          return;
        }

        const headers = results.meta.fields || [];
        setCsvHeaders(headers);
        setCsvData(results.data as Record<string, string>[]);

        // Auto-mapeo si los nombres coinciden
        const autoMapping: Record<string, string> = {};
        if (currentTable) {
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
        }
        setColumnMapping(autoMapping);
        setUploadStatus("ready");
      },
      error: (error) => {
        setUploadStatus("error");
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

  const handlePreview = async () => {
    if (!selectedTable || csvData.length === 0) return;

    setUploadStatus("uploading");
    setErrorMessage("");

    try {
      // Transformar datos usando el mapeo
      const transformedData = csvData.map((row) => {
        const transformed: Record<string, string | number> = {};
        Object.entries(columnMapping).forEach(([dbField, csvColumn]) => {
          if (csvColumn && row[csvColumn] !== undefined) {
            transformed[dbField] = row[csvColumn];
          }
        });
        return transformed;
      });

      const response = await fetch("/api/csv-upload/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          table: selectedTable,
          data: transformedData,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Error al previsualizar datos");
      }

      const result = await response.json();
      setPreviewData(result);
      setUploadStatus("ready");
    } catch (error) {
      setUploadStatus("error");
      setErrorMessage(error instanceof Error ? error.message : "Error desconocido");
    }
  };

  const handleImport = async () => {
    if (!selectedTable || csvData.length === 0) return;

    setUploadStatus("uploading");
    setErrorMessage("");

    try {
      // Transformar datos usando el mapeo
      const transformedData = csvData.map((row) => {
        const transformed: Record<string, string | number> = {};
        Object.entries(columnMapping).forEach(([dbField, csvColumn]) => {
          if (csvColumn && row[csvColumn] !== undefined) {
            transformed[dbField] = row[csvColumn];
          }
        });
        return transformed;
      });

      const response = await fetch("/api/csv-upload/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          table: selectedTable,
          data: transformedData,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Error al importar datos");
      }

      const result = await response.json();
      setUploadStatus("success");
      setPreviewData(result);

      // Reset después de 3 segundos
      setTimeout(() => {
        setUploadStatus("idle");
        setCsvData([]);
        setCsvHeaders([]);
        setColumnMapping({});
        setPreviewData(null);
      }, 3000);
    } catch (error) {
      setUploadStatus("error");
      setErrorMessage(error instanceof Error ? error.message : "Error desconocido");
    }
  };

  const isValidMapping = () => {
    if (!currentTable) return false;

    // Verificar que todos los campos requeridos estén mapeados
    const requiredFields = currentTable.fields.filter((f) => f.required);
    return requiredFields.every((field) => columnMapping[field.name] && columnMapping[field.name] !== "");
  };

  return (
    <div className="space-y-6">
      {/* Selector de tabla */}
      <div className="card bg-base-100 shadow">
        <div className="card-body p-4">
          <h2 className="card-title text-lg">Seleccionar tabla destino</h2>
          <Input
            as="select"
            value={selectedTable}
            onChange={(e) => {
              setSelectedTable(e.target.value);
              setCsvData([]);
              setCsvHeaders([]);
              setColumnMapping({});
              setUploadStatus("idle");
              setPreviewData(null);
            }}
          >
            <option value="">-- Seleccionar tabla --</option>
            {TABLE_OPTIONS.map((table) => (
              <option key={table.value} value={table.value}>
                {table.label}
              </option>
            ))}
          </Input>

          {currentTable && (
            <div className="mt-4">
              <h3 className="mb-2 text-sm font-medium">Campos de la tabla:</h3>
              <div className="flex flex-wrap gap-2">
                {currentTable.fields.map((field) => (
                  <span
                    key={field.name}
                    className={`badge badge-sm ${field.required ? "badge-primary" : "badge-ghost"}`}
                  >
                    {field.name}
                    {field.required && " *"}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Subida de archivo */}
      {selectedTable && (
        <div className="card bg-base-100 shadow">
          <div className="card-body p-4">
            <h2 className="card-title text-lg">Subir archivo CSV</h2>
            <FileInput
              accept=".csv"
              onChange={handleFileChange}
              disabled={uploadStatus === "uploading"}
              label="Selecciona un archivo CSV"
            />

            {uploadStatus === "parsing" && (
              <div className="alert">
                <span className="loading loading-spinner loading-sm"></span>
                <span>Procesando archivo...</span>
              </div>
            )}

            {uploadStatus === "error" && (
              <div className="alert alert-error">
                <AlertCircle size={20} />
                <span>{errorMessage}</span>
              </div>
            )}

            {uploadStatus === "success" && (
              <div className="alert alert-success">
                <CheckCircle size={20} />
                <span>Datos importados exitosamente</span>
                {previewData && (
                  <span className="text-xs">
                    ({previewData.inserted || 0} insertados, {previewData.updated || 0} actualizados,{" "}
                    {previewData.skipped || 0} omitidos)
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Mapeo de columnas */}
      {csvHeaders.length > 0 && currentTable && (
        <div className="card bg-base-100 shadow">
          <div className="card-body p-4">
            <h2 className="card-title text-lg">Mapeo de columnas</h2>
            <p className="text-base-content/70 mb-4 text-sm">
              Relaciona cada columna del CSV con el campo correspondiente de la base de datos. Los campos marcados con *
              son obligatorios.
            </p>

            <div className="overflow-x-auto">
              <table className="table-sm table">
                <thead>
                  <tr>
                    <th>Campo BD</th>
                    <th>Tipo</th>
                    <th>Columna CSV</th>
                    <th>Vista previa</th>
                  </tr>
                </thead>
                <tbody>
                  {currentTable.fields.map((field) => (
                    <tr key={field.name}>
                      <td>
                        <span className={field.required ? "font-semibold" : ""}>
                          {field.name}
                          {field.required && <span className="text-error ml-1">*</span>}
                        </span>
                      </td>
                      <td>
                        <span className="badge badge-xs badge-ghost">{field.type}</span>
                      </td>
                      <td>
                        <Input
                          as="select"
                          size="xs"
                          className="w-full max-w-xs"
                          value={columnMapping[field.name] || ""}
                          onChange={(e) => handleColumnMapChange(field.name, e.target.value)}
                        >
                          <option value="">-- Sin mapear --</option>
                          {csvHeaders.map((header) => (
                            <option key={header} value={header}>
                              {header}
                            </option>
                          ))}
                        </Input>
                      </td>
                      <td>
                        <span className="text-base-content/50 inline-block max-w-50 truncate text-xs">
                          {(() => {
                            const mappedColumn = columnMapping[field.name];
                            if (mappedColumn && csvData[0]) {
                              return csvData[0][mappedColumn] || "-";
                            }
                            return "-";
                          })()}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-4 flex items-center gap-2">
              <p className="text-sm">
                <span className="font-medium">{csvData.length}</span> filas detectadas
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Vista previa */}
      {previewData && uploadStatus !== "success" && (
        <div className="card bg-base-100 shadow">
          <div className="card-body p-4">
            <h2 className="card-title text-lg">Vista previa de importación</h2>
            <div className="grid grid-cols-3 gap-4">
              <div className="stat bg-base-200 rounded-lg p-3">
                <div className="stat-title text-xs">Insertados</div>
                <div className="stat-value text-success text-2xl">{previewData.toInsert || 0}</div>
              </div>
              <div className="stat bg-base-200 rounded-lg p-3">
                <div className="stat-title text-xs">Actualizados</div>
                <div className="stat-value text-info text-2xl">{previewData.toUpdate || 0}</div>
              </div>
              <div className="stat bg-base-200 rounded-lg p-3">
                <div className="stat-title text-xs">Omitidos</div>
                <div className="stat-value text-warning text-2xl">{previewData.toSkip || 0}</div>
              </div>
            </div>

            {previewData.errors && previewData.errors.length > 0 && (
              <div className="alert alert-warning mt-4">
                <AlertCircle size={20} />
                <div>
                  <p className="font-medium">Errores de validación:</p>
                  <ul className="mt-1 list-inside list-disc text-xs">
                    {previewData.errors.slice(0, 5).map((err: string, idx: number) => (
                      <li key={idx}>{err}</li>
                    ))}
                    {previewData.errors.length > 5 && <li>... y {previewData.errors.length - 5} más</li>}
                  </ul>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Acciones */}
      {csvData.length > 0 && (
        <div className="card bg-base-100 shadow">
          <div className="card-body p-4">
            <div className="flex gap-3">
              <Button
                type="button"
                variant="outline"
                className="gap-2"
                onClick={handlePreview}
                disabled={!isValidMapping() || uploadStatus === "uploading"}
              >
                <Upload size={16} />
                Vista previa
              </Button>
              <Button
                type="button"
                variant="primary"
                className="gap-2"
                onClick={handleImport}
                disabled={!isValidMapping() || uploadStatus === "uploading"}
              >
                <ArrowRight size={16} />
                {uploadStatus === "uploading" ? "Importando..." : "Importar datos"}
              </Button>
            </div>

            {!isValidMapping() && (
              <p className="text-error mt-2 text-sm">
                <AlertCircle size={14} className="mr-1 inline" />
                Debes mapear todos los campos obligatorios antes de importar
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
