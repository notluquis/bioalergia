import { useState } from "react";
import { deriveMovements, parseDelimited, type Movement } from "@/mp/reports";
import { useSettings } from "../../../context/settings-context";

interface UseReportUploadResult {
  movs: Movement[];
  fileName: string | null;
  error: string | null;
  onFile: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export function useReportUpload(): UseReportUploadResult {
  const [movs, setMovs] = useState<Movement[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
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
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error al leer el archivo";
      setError(message);
      setMovs([]);
      setFileName(null);
    }
  }

  return { movs, fileName, error, onFile };
}
