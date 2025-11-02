import { useFileUpload } from "../../../hooks";
import { fileHasWithdrawHeader } from "../../../lib/csvUtils";
import Button from "../../../components/Button";
import FileInput from "../../../components/FileInput";
import Alert from "../../../components/Alert";
import UploadResults from "../../../components/UploadResults";

// Validator para archivos de retiros
async function validateWithdrawFile(file: File) {
  const hasToken = await fileHasWithdrawHeader(file);
  return {
    missing: hasToken ? [] : ["withdraw_id"],
    headersCount: hasToken ? 1 : 0,
  };
}

export default function PayoutUploadForm() {
  const {
    files,
    loading,
    error,
    results,
    handleUpload,
    handleFileChange,
  } = useFileUpload({
    endpoint: "/api/transactions/withdrawals/upload",
    logContext: "[withdrawals]",
    validator: validateWithdrawFile,
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
    <div className="mt-8 space-y-3 border-t border-slate-200 pt-6">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        Subir CSV de retiros
      </h2>
      <p className="text-xs text-slate-500">
        Complementa los retiros con los datos bancarios y del titular para que se reflejen junto a los movimientos existentes.
      </p>
      <FileInput
        label="Selecciona los archivos CSV de retiros"
        accept=".csv,.txt"
        onChange={handleFileChange}
        multiple
      />
      <Button
        variant="secondary"
        onClick={handleUpload}
        disabled={loading}
      >
        {loading ? "Subiendo retiros..." : "Importar retiros"}
      </Button>
      {files.length > 0 && !loading && !error && (
        <p className="text-xs text-slate-500">
          Archivos seleccionados: {files.map((f) => f.name).join(", ")}
        </p>
      )}
      {error && <Alert variant="error">{error}</Alert>}
      <UploadResults results={results} variant="secondary" />
    </div>
  );
}
