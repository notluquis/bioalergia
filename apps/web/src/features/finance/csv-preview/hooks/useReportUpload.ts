/**
 * Report Upload Hook
 */

import { useState } from "react";

import { useSettings } from "@/context/SettingsContext";
import { deriveMovements, parseDelimited } from "@/mp/reports";

import type { Movement } from "../types";

interface UseReportUploadResult {
  movs: Movement[];
  fileName: string | null;
  error: string | null;
  onFile: (e: React.ChangeEvent<HTMLInputElement>) => void;
  clearFile: () => void;
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
      const mpMovs = deriveMovements(rows, { accountName: settings.orgName });
      // Convert MP movements to our type (handle undefined → null)
      const movements: Movement[] = mpMovs.map((m) => ({
        ...m,
        description: m.description ?? null,
        counterparty: m.counterparty ?? null,
        from: m.from ?? null,
        to: m.to ?? null,
      }));
      setMovs(movements);
      setFileName(f.name);
      setError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error al leer el archivo";
      setError(message);
      setMovs([]);
      setFileName(null);
    }
  }

  function clearFile() {
    setMovs([]);
    setFileName(null);
    setError(null);
  }

  return { movs, fileName, error, onFile, clearFile };
}
