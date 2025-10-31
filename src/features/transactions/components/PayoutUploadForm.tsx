import PayoutPreviewUpload from "./PayoutPreviewUpload";

export default function PayoutUploadForm() {
  return (
    <div className="mt-8 space-y-3 border-t border-slate-200 pt-6">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Subir CSV de retiros (Previsualizar)</h2>
      <p className="text-xs text-slate-500">Parsing y previsualización en el cliente; confirma para importar al servidor.</p>

      <PayoutPreviewUpload />
    </div>
  );
}
