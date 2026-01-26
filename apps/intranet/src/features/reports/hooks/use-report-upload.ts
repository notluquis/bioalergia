import { useState } from "react";

import { useSettings } from "@/context/SettingsContext";
import { deriveMovements, type Movement, parseDelimited } from "@/mp/reports";

interface UseReportUploadResult {
  error: null | string;
  fileName: null | string;
  movs: Movement[];
  onFile: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export function useReportUpload(): UseReportUploadResult {
  const [movs, setMovs] = useState<Movement[]>([]);
  const [fileName, setFileName] = useState<null | string>(null);
  const [error, setError] = useState<null | string>(null);
  const { settings } = useSettings();

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    try {
      const text = await f.text();
      const rows = parseDelimited(text);
      setMovs(deriveMovements(rows, { accountName: settings.orgName }));
      setFileName(f.name);
      setError(null);
    } catch (error_) {
      const message = error_ instanceof Error ? error_.message : "Error al leer el archivo";
      setError(message);
      setMovs([]);
      setFileName(null);
    }
  }

  return { error, fileName, movs, onFile };
}
