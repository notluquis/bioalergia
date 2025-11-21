import { useFileUpload } from "../../../hooks";
import { analyzeTransactionHeaders } from "../../../lib/csvUtils";
import Button from "../../../components/ui/Button";
import FileInput from "../../../components/ui/FileInput";
import Alert from "../../../components/ui/Alert";
import UploadResults from "../../../components/features/UploadResults";

export default function TransactionUploadForm() {
  const { files, loading, error, results, handleUpload, handleFileChange } = useFileUpload({
    endpoint: "/api/transactions/upload",
    logContext: "[upload]",
    validator: analyzeTransactionHeaders,
    multiple: true,
    confirmOnValidationWarning: true,
    invalidateKeys: [
      ["dashboard", "stats"],
      ["dashboard", "recentMovements"],
      ["participants", "leaderboard"],
      ["stats", "overview"],
      ["balances", "report"],
      ["transactions", "movements"],
    ],
  });

  return (
    <div className="space-y-4 rounded-2xl border border-primary/15 bg-base-100 p-6 text-sm shadow-sm">
      <FileInput
        label="Selecciona uno o varios archivos CSV de Mercado Pago"
        accept=".csv,.txt"
        onChange={handleFileChange}
        multiple
      />
      <Button onClick={handleUpload} disabled={loading}>
        {loading ? "Subiendo..." : "Subir a la base de datos"}
      </Button>
      <ul className="list-disc space-y-1 pl-5 text-xs text-base-content/60">
        <li>El archivo no debe superar los 15&nbsp;MB.</li>
        <li>Los movimientos duplicados se ignoran automáticamente.</li>
      </ul>
      {files.length > 0 && !loading && !error && (
        <p className="text-xs text-base-content/60">Archivos seleccionados: {files.map((f) => f.name).join(", ")}</p>
      )}
      {error && <Alert variant="error">{error}</Alert>}
      <UploadResults results={results} />
    </div>
  );
}
