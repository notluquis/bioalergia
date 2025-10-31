import React from "react";

type UploadSummary = {
  status: string;
  inserted: number;
  skipped?: number;
  updated?: number;
  total: number;
};

type UploadResult = {
  file: string;
  summary?: UploadSummary;
  error?: string;
};

interface UploadResultsProps {
  results: UploadResult[];
  variant?: "primary" | "secondary";
}

export default function UploadResults({ results, variant = "primary" }: UploadResultsProps) {
  if (results.length === 0) {
    return null;
  }

  const colorClass =
    variant === "primary"
      ? "bg-[var(--brand-primary)]/10 text-[var(--brand-primary)]"
      : "bg-[var(--brand-secondary)]/10 text-[var(--brand-secondary)]";
  return (
    <div className={`card bg-base-100 p-4 text-xs shadow-sm ${colorClass}`}>
      <div className="card-body p-0">
        <p className="font-semibold mb-2">Resultados</p>
        <ul className="space-y-2 text-slate-600">
          {results.map((result) => (
            <li key={result.file} className="flex flex-wrap items-center justify-between gap-2 rounded-lg p-2">
              <span className="font-medium">{result.file}</span>
              {result.summary ? (
                <div className="text-xs text-slate-600">
                  <span className="mr-2">Inserted: {result.summary.inserted}</span>
                  {typeof result.summary.updated === "number" ? (
                    <span className="mr-2">Updated: {result.summary.updated}</span>
                  ) : typeof result.summary.skipped === "number" ? (
                    <span className="mr-2">Skipped: {result.summary.skipped}</span>
                  ) : null}
                  <span>Total: {result.summary.total}</span>
                </div>
              ) : (
                <span className="text-rose-600">{result.error}</span>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
