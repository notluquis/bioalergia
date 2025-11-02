import { useState } from "react";
import { useMutation, useQueryClient, type QueryKey } from "@tanstack/react-query";
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
  invalidateKeys?: QueryKey[];
  onUploadSuccess?: (results: UploadResult[]) => void;
}

export function useFileUpload({
  endpoint,
  logContext,
  validator,
  multiple = true,
  confirmOnValidationWarning = true,
  invalidateKeys = [],
  onUploadSuccess,
}: UseFileUploadOptions) {
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<UploadResult[]>([]);
  const queryClient = useQueryClient();

  const uploadMutation = useMutation<UploadResult[], Error, File[]>({
    mutationFn: async (selectedFiles) => {
      return uploadFiles(selectedFiles, endpoint, logContext);
    },
    onSuccess: (uploadResults) => {
      setResults(uploadResults);
      setError(null);
      invalidateKeys.forEach((key) => {
        queryClient.invalidateQueries({ queryKey: key });
      });
      onUploadSuccess?.(uploadResults);
    },
    onError: (err) => {
      setError(err.message || "Error al subir archivos");
    },
  });

  const handleUpload = async () => {
    if (!files.length) {
      setError("Selecciona uno o más archivos antes de subirlos.");
      return;
    }
    setError(null);
    setResults([]);

    try {
      uploadMutation.reset();
      await uploadMutation.mutateAsync(files);
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Error al subir archivos");
      }
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
    uploadMutation.reset();
  };

  return {
    files,
    setFiles,
    loading: uploadMutation.isPending,
    error,
    results,
    handleUpload,
    handleFileChange,
    reset,
  };
}
