/**
 * Report Upload Hook
 */

import { useState } from "react";

import { useSettings } from "@/context/SettingsContext";
import { apiClient } from "@/lib/apiClient";
import { deriveMovements, parseDelimited } from "@/mp/reports";

import type { Movement } from "../types";

interface ImportResult {
  status: string;
  inserted?: number;
  updated?: number;
  skipped?: number;
  errors?: string[];
}

interface UseReportUploadResult {
  movs: Movement[];
  fileName: string | null;
  error: string | null;
  importing: boolean;
  importResult: ImportResult | null;
  onFile: (e: React.ChangeEvent<HTMLInputElement>) => void;
  clearFile: () => void;
  importToDatabase: () => Promise<void>;
}

export function useReportUpload(): UseReportUploadResult {
  const [movs, setMovs] = useState<Movement[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
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
    setImportResult(null);
  }

  async function importToDatabase() {
    if (movs.length === 0) {
      setError("No hay movimientos para importar");
      return;
    }

    setImporting(true);
    setError(null);
    setImportResult(null);

    try {
      // Convert movements to transaction format expected by backend
      const transactions = movs.map((m) => ({
        timestamp: m.timestamp,
        description: m.description ?? undefined,
        amount: m.amount,
        direction: m.direction,
        rut: m.counterparty ?? undefined,
        origin: m.from ?? undefined,
        destination: m.to ?? undefined,
      }));

      const result = await apiClient.post<ImportResult>("/api/csv-upload/import", {
        table: "transactions",
        data: transactions,
      });

      setImportResult(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error al importar datos";
      setError(message);
      setImportResult(null);
    } finally {
      setImporting(false);
    }
  }

  return { movs, fileName, error, importing, importResult, onFile, clearFile, importToDatabase };
}
