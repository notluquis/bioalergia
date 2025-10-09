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
    <div className={`space-y-2 rounded-lg p-4 text-xs ${colorClass}`}>
      <p className="font-semibold">Resultados</p>
      <ul className="space-y-1 text-slate-600">
        {results.map((result) => (
          <li key={result.file} className="flex flex-wrap items-center justify-between gap-2">
            <span>{result.file}</span>
            {result.summary ? (
              <span>
                Insertadas: {result.summary.inserted}
                {typeof result.summary.updated === "number"
                  ? ` · Actualizadas: ${result.summary.updated}`
                  : typeof result.summary.skipped === "number"
                    ? ` · Omitidas: ${result.summary.skipped}`
                    : ""}
                · Total: {result.summary.total}
              </span>
            ) : (
              <span className="text-rose-600">{result.error}</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
