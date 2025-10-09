import { useState } from "react";
import { uploadFiles, type UploadResult } from "../lib/apiClient";
import { logger } from "../lib/logger";

interface FileValidator {
  (file: File): Promise<{ missing: string[]; headersCount: number }>;
}

interface UseFileUploadOptions {
  endpoint: string;
  logContext: string;
  validator?: FileValidator;
  multiple?: boolean;
  confirmOnValidationWarning?: boolean;
}

export function useFileUpload({
  endpoint,
  logContext,
  validator,
  multiple = true,
  confirmOnValidationWarning = true,
}: UseFileUploadOptions) {
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<UploadResult[]>([]);

  const handleUpload = async () => {
    if (!files.length) {
      setError("Selecciona uno o más archivos antes de subirlos.");
      return;
    }
    setLoading(true);
    setError(null);
    setResults([]);

    try {
      const uploadResults = await uploadFiles(files, endpoint, logContext);
      setResults(uploadResults);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al subir archivos");
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(event.target.files ?? []);
    reset();

    if (!selected.length) {
      setFiles([]);
      return;
    }

    // Validación opcional de archivos
    if (validator) {
      const analyses = await Promise.all(selected.map(async (file) => ({ file, ...(await validator(file)) })));

      const problematic = analyses.filter((item) => item.missing.length);
      logger.info(
        `${logContext} archivos seleccionados`,
        analyses.map(({ file, headersCount, missing }) => ({
          file: file.name,
          headersCount,
          missing,
        }))
      );

      if (problematic.length && confirmOnValidationWarning) {
        const message = problematic
          .map(
            ({ file, missing, headersCount }) =>
              `${file.name}: faltan ${missing.join(", ")} · columnas detectadas: ${headersCount}`
          )
          .join("\n");

        const proceed = window.confirm(
          `Advertencia: algunos archivos no contienen todas las columnas esperadas.\n\n${message}\n\n¿Deseas continuar igualmente?`
        );

        if (!proceed) {
          setFiles([]);
          event.target.value = "";
          return;
        }
      }
    }

    setFiles(multiple ? selected : [selected[0]]);
  };

  const reset = () => {
    setFiles([]);
    setError(null);
    setResults([]);
  };

  return {
    files,
    setFiles,
    loading,
    error,
    results,
    handleUpload,
    handleFileChange,
    reset,
  };
}
