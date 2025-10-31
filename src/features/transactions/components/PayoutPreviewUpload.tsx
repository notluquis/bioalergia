import React, { useMemo, useState } from "react";
import Papa from "papaparse";
import Button from "../../../components/Button";
import Alert from "../../../components/Alert";
import UploadResults from "../../../components/UploadResults";
import { fileHasWithdrawHeader } from "../../../lib/csvUtils";

type RawRow = Record<string, string>;

type PayoutRaw = Record<string, string | null>;

type Payout = {
  withdrawId: string;
  dateCreated?: string | null;
  status?: string | null;
  statusDetail?: string | null;
  amount?: number | null;
  fee?: number | null;
  activityUrl?: string | null;
  payoutDesc?: string | null;
  bankAccountHolder?: string | null;
  identificationType?: string | null;
  identificationNumber?: string | null;
  bankId?: string | null;
  bankName?: string | null;
  bankBranch?: string | null;
  bankAccountType?: string | null;
  bankAccountNumber?: string | null;
  raw: PayoutRaw;
};

type PreviewPayload = {
  payouts: Payout[];
  counts: { insert: number; update: number; skip: number; total: number } | null;
  samples: { insert: Payout[]; update: Payout[] } | null;
};

type UploadSummaryLocal = {
  status: string;
  inserted: number;
  skipped?: number;
  updated?: number;
  total: number;
};

type UploadResultLocal = { file: string; summary?: UploadSummaryLocal; error?: string };

function normalizeHeaderKey(header: string): string | null {
  if (!header) return null;
  const trimmed = header.trim();
  if (!trimmed) return null;

  const parenMatch = trimmed.match(/\(([^)]+)\)/);
  if (parenMatch) {
    return parenMatch[1].trim().toLowerCase();
  }

  return trimmed
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .toLowerCase();
}

function parseNumber(value: string | null | undefined): number | null {
  if (value == null) return null;
  const cleaned = String(value)
    .replace(/CLP/gi, "")
    .replace(/\$/g, "")
    .replace(/\s+/g, "")
    .replace(/[^0-9,.-]/g, "");
  if (!cleaned || cleaned === "-" || cleaned === "." || cleaned === ",") return null;

  let normalized = cleaned;
  if (cleaned.includes(",") && cleaned.includes(".")) {
    normalized = cleaned.replace(/\./g, "").replace(/,/g, ".");
  } else {
    normalized = cleaned.replace(/,/g, ".");
  }

  const num = Number(normalized);
  return Number.isFinite(num) ? num : null;
}

function canonicalize(value: unknown): string {
  if (value === null || value === undefined) return JSON.stringify(null);
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return JSON.stringify(value.map((v) => JSON.parse(canonicalize(v))));
  }
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj).sort();
    const normalized: Record<string, unknown> = {};
    for (const k of keys) {
      normalized[k] = JSON.parse(canonicalize(obj[k]));
    }
    return JSON.stringify(normalized);
  }
  return JSON.stringify(value);
}

export default function PayoutPreviewUpload() {
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<PreviewPayload | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [importing, setImporting] = useState(false);
  const [results, setResults] = useState<UploadResultLocal[] | null>(null);

  const handleFile = async (f: File | null) => {
    setError(null);
    setPreview(null);
    setResults(null);
    setFile(f);
    if (!f) return;

    // Quick header check
    const hasToken = await fileHasWithdrawHeader(f);
    if (!hasToken) {
      setError("El CSV no parece contener la columna 'withdraw_id'.");
      return;
    }

    setLoadingPreview(true);
    try {
      const text = await f.text();
      const parsed = Papa.parse<RawRow>(text, {
        header: true,
        skipEmptyLines: true,
        transformHeader: (h) => (normalizeHeaderKey(String(h)) ?? "").toLowerCase(),
      });

      if (parsed.errors.length) {
        setError("No se pudo parsear el CSV");
        setLoadingPreview(false);
        return;
      }

      const rows = parsed.data.map((r) => {
        const normalized: PayoutRaw = {};
        for (const [k, v] of Object.entries(r)) {
          if (!k) continue;
          const val = (v as string | undefined)?.trim?.() ?? "";
          normalized[k] = val === "" ? null : val;
        }
        return normalized;
      });

      // Build payouts array similar to server.transformPayouts.buildPayouts
      const payouts: Payout[] = [];
      for (const row of rows) {
        const withdrawIdRaw = row["withdraw_id"] ?? row["withdrawId"] ?? row["withdraw-id"] ?? null;
        if (!withdrawIdRaw) continue;
        const withdrawId = String(withdrawIdRaw).trim();
        if (!withdrawId) continue;
        payouts.push({
          withdrawId,
          dateCreated: (row["date_created"] as string) ?? null,
          status: (row["status"] as string) ?? null,
          statusDetail: (row["status_detail"] as string) ?? null,
          amount: parseNumber(row["amount"] ?? null),
          fee: parseNumber(row["fee"] ?? null),
          activityUrl: (row["activity_url"] as string) ?? null,
          payoutDesc: (row["payout_desc"] as string) ?? null,
          bankAccountHolder: (row["bank_account_holder"] as string) ?? null,
          identificationType: (row["identification_type"] as string) ?? null,
          identificationNumber: (row["identification_number"] as string) ?? null,
          bankId: (row["bank_id"] as string) ?? null,
          bankName: (row["bank_name"] as string) ?? null,
          bankBranch: (row["bank_branch"] as string) ?? null,
          bankAccountType: (row["bank_account_type"] as string) ?? null,
          bankAccountNumber: (row["bank_account_number"] as string) ?? null,
          raw: row,
        });
      }

      const ids = payouts.map((p) => p.withdrawId).filter(Boolean);
      // Request existing rows from server
      const resp = await fetch("/api/transactions/withdrawals/preview", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });

      if (!resp.ok) {
        throw new Error("No se pudo obtener datos del servidor para previsualizar");
      }
      const payload = await resp.json();
      const existing: Record<string, string | null> = payload?.existing ?? {};

      // Compare
      let insert = 0;
      let update = 0;
      let skip = 0;
      const insertSamples: Payout[] = [];
      const updateSamples: Payout[] = [];

      for (const p of payouts) {
        const existingRaw = existing[p.withdrawId] ?? null;
        if (existingRaw == null) {
          insert += 1;
          if (insertSamples.length < 10) insertSamples.push(p);
        } else {
          let existingCanon = "";
          try {
            existingCanon = canonicalize(JSON.parse(existingRaw));
          } catch {
            existingCanon = String(existingRaw);
          }
          const currentCanon = canonicalize(p.raw);
          if (existingCanon !== currentCanon) {
            update += 1;
            if (updateSamples.length < 10) updateSamples.push(p);
          } else {
            skip += 1;
          }
        }
      }

      setPreview({ payouts, counts: { insert, update, skip, total: payouts.length }, samples: { insert: insertSamples, update: updateSamples } });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoadingPreview(false);
    }
  };

  const handleConfirm = async () => {
    if (!preview) return;
    setImporting(true);
    setResults(null);
    try {
      const res = await fetch("/api/transactions/withdrawals/import", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payouts: preview.payouts }),
      });
      const payload = await res.json();
      if (!res.ok || payload?.status === "error") {
        throw new Error(payload?.message ?? "Error al importar");
      }
      setResults([{ file: file?.name ?? "client_generated", summary: payload as UploadSummaryLocal }]);
      // clear preview
      setPreview(null);
      setFile(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setImporting(false);
    }
  };

  const sampleRows = useMemo(() => {
    if (!preview) return null;
    return (preview.samples?.update ?? []).concat(preview.samples?.insert ?? []).slice(0, 20);
  }, [preview]);

  return (
    <div className="mt-8 space-y-3 border-t border-slate-200 pt-6">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Subir CSV de retiros (previsualizar)</h2>
      <p className="text-xs text-slate-500">Analiza localmente el CSV, muestra cuántos registros se insertarían/actualizarían/ignorarían y te permite confirmar la importación.</p>

      <div>
        <input
          type="file"
          accept=".csv,.txt"
          onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
          className="block"
        />
      </div>

      {error && <Alert variant="error">{error}</Alert>}

      {loadingPreview && <div className="text-sm text-slate-500">Generando previsualización...</div>}

      {preview && preview.counts && (
        <div className="space-y-2">
          <div className="text-sm text-slate-600">Total filas detectadas: {preview.counts.total}</div>
          <div className="flex gap-4 text-sm">
            <div className="text-green-600">Insertar: {preview.counts.insert}</div>
            <div className="text-yellow-600">Actualizar: {preview.counts.update}</div>
            <div className="text-slate-500">Ignorar: {preview.counts.skip}</div>
          </div>

          {sampleRows && sampleRows.length > 0 && (
            <div className="mt-2">
              <h3 className="text-xs font-semibold">Muestras (hasta 20)</h3>
              <div className="overflow-auto max-h-64 border rounded bg-base-100/60 p-2 text-xs">
                <pre className="whitespace-pre-wrap">{JSON.stringify(sampleRows, null, 2)}</pre>
              </div>
            </div>
          )}

          <div className="flex gap-2">
            <Button variant="primary" onClick={handleConfirm} disabled={importing}>
              {importing ? "Importando..." : "Confirmar importación"}
            </Button>
            <Button variant="ghost" onClick={() => { setPreview(null); setFile(null); setError(null); }}>
              Cancelar
            </Button>
          </div>
        </div>
      )}

      {results && <UploadResults results={results} variant="secondary" />}
    </div>
  );
}
