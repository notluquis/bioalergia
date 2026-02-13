import { type QueryKey, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { type UploadResult, uploadFiles } from "@/lib/api-client";
import { logger } from "@/lib/logger";

type FileValidator = (file: File) => Promise<{ headersCount: number; missing: string[] }>;

interface UseFileUploadOptions {
  confirmOnValidationWarning?: boolean;
  endpoint: string;
  invalidateKeys?: QueryKey[];
  logContext: string;
  multiple?: boolean;
  onUploadSuccess?: (results: UploadResult[]) => void;
  validator?: FileValidator;
}

export function useFileUpload({
  confirmOnValidationWarning = true,
  endpoint,
  invalidateKeys = [],
  logContext,
  multiple = true,
  onUploadSuccess,
  validator,
}: UseFileUploadOptions) {
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState<null | string>(null);
  const [results, setResults] = useState<UploadResult[]>([]);
  const queryClient = useQueryClient();

  const uploadMutation = useMutation<UploadResult[], Error, File[]>({
    mutationFn: async (selectedFiles) => {
      return uploadFiles(selectedFiles, endpoint, logContext);
    },
    onError: (err) => {
      setError(err.message || "Error al subir archivos");
    },
    onSuccess: (uploadResults) => {
      setResults(uploadResults);
      setError(null);
      for (const key of invalidateKeys) {
        queryClient.invalidateQueries({ queryKey: key });
      }
      onUploadSuccess?.(uploadResults);
    },
  });

  const handleUpload = async () => {
    if (files.length === 0) {
      setError("Selecciona uno o más archivos antes de subirlos.");
      return;
    }
    setError(null);
    setResults([]);

    try {
      uploadMutation.reset();
      await uploadMutation.mutateAsync(files);
    } catch (error_) {
      if (error_ instanceof Error) {
        setError(error_.message);
      } else {
        setError("Error al subir archivos");
      }
    }
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selected = [...(event.target.files ?? [])];
    reset();

    if (selected.length === 0) {
      setFiles([]);
      return;
    }

    const validateSelectedFiles = async () => {
      if (!validator) {
        return true;
      }
      const analyses = await Promise.all(
        selected.map(async (file) => ({ file, ...(await validator(file)) })),
      );
      const problematic = analyses.filter((item) => item.missing.length > 0);

      logger.info(
        `${logContext} archivos seleccionados`,
        analyses.map(({ file, headersCount, missing }) => ({
          file: file.name,
          headersCount,
          missing,
        })),
      );

      if (problematic.length === 0 || !confirmOnValidationWarning) {
        return true;
      }

      const message = problematic
        .map(
          ({ file, headersCount, missing }) =>
            `${file.name}: faltan ${missing.join(", ")} · columnas detectadas: ${headersCount}`,
        )
        .join("\n");

      return globalThis.confirm(
        `Advertencia: algunos archivos no contienen todas las columnas esperadas.\n\n${message}\n\n¿Deseas continuar igualmente?`,
      );
    };

    const canContinue = await validateSelectedFiles();
    if (!canContinue) {
      setFiles([]);
      event.target.value = "";
      return;
    }

    const firstFile = selected[0];
    let newFiles: File[] = [];

    if (multiple) {
      newFiles = selected;
    } else if (firstFile) {
      newFiles = [firstFile];
    }

    setFiles(newFiles);
  };

  const reset = () => {
    setFiles([]);
    setError(null);
    setResults([]);
    uploadMutation.reset();
  };

  return {
    error,
    files,
    handleFileChange,
    handleUpload,
    loading: uploadMutation.isPending,
    reset,
    results,
    setFiles,
  };
}
