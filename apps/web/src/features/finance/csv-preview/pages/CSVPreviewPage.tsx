/**
 * CSV Preview Page
 * Allows users to preview Mercado Pago CSV reports before importing
 */

import { FileText } from "lucide-react";
import { useMemo, useState } from "react";

import Alert from "@/components/ui/Alert";
import Button from "@/components/ui/Button";
import FileInput from "@/components/ui/FileInput";
import Input from "@/components/ui/Input";
import { useAuth } from "@/context/AuthContext";
import { coerceAmount } from "@/lib/format";
import { PAGE_CONTAINER, TITLE_LG } from "@/lib/styles";

import ReportTable from "../components/ReportTable";
import { useReportUpload } from "../hooks/useReportUpload";
import type { LedgerRow } from "../types";

export default function CSVPreviewPage() {
  const { can } = useAuth();
  const [initialBalance, setInitialBalance] = useState<string>("0");
  const { movs, fileName, error: uploadError, onFile, clearFile } = useReportUpload();

  const canView = can("read", "Transaction");

  const ledger: LedgerRow[] = useMemo(() => {
    const initialBalanceNumber = coerceAmount(initialBalance);

    // Use reduce to avoid mutation
    const result: { rows: LedgerRow[]; balance: number } = movs.reduce(
      (acc, m) => {
        const delta = m.direction === "IN" ? m.amount : m.direction === "OUT" ? -m.amount : 0;
        const newBalance = acc.balance + delta;
        acc.rows.push({ ...m, runningBalance: newBalance, delta });
        acc.balance = newBalance;
        return acc;
      },
      { rows: [] as LedgerRow[], balance: initialBalanceNumber }
    );

    return result.rows;
  }, [movs, initialBalance]);

  if (!canView) {
    return (
      <section className={PAGE_CONTAINER}>
        <h1 className={TITLE_LG}>Vista Previa CSV</h1>
        <Alert variant="error">No tienes permisos para ver esta página.</Alert>
      </section>
    );
  }

  return (
    <section className={PAGE_CONTAINER}>
      {/* Header */}
      <header>
        <h1 className={TITLE_LG}>Vista Previa de Reportes CSV</h1>
        <p className="text-base-content/70 mt-1 text-sm">
          Visualiza y valida un CSV de Mercado Pago antes de cargarlo en la base de datos
        </p>
      </header>

      {/* Instructions Card */}
      <div className="bg-base-100 border-base-200 space-y-3 rounded-2xl border p-6 shadow-sm">
        <div className="flex items-start gap-3">
          <FileText className="text-primary mt-1 h-5 w-5 shrink-0" />
          <div className="space-y-2 text-sm">
            <p className="font-medium">
              Genera el <strong>Account balance report</strong> desde el panel de Mercado Pago y súbelo para ver los
              movimientos IN/OUT.
            </p>
            <ul className="text-base-content/70 ml-4 list-disc space-y-1 text-xs">
              <li>Dashboard → Reports → Finanzas → Account balance report</li>
              <li>Descarga el archivo en CSV (o formato delimitado compatible) y cárgalo aquí</li>
              <li>Ajusta el saldo inicial para recalcular el saldo acumulado correctamente</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Upload Controls */}
      <div className="bg-base-100 border-base-200 rounded-2xl border p-6 shadow-sm">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="form-control">
            <label htmlFor="initial-balance" className="label text-sm font-medium">
              Saldo inicial (CLP)
            </label>
            <Input
              id="initial-balance"
              type="text"
              value={initialBalance}
              onChange={(event) => setInitialBalance(event.target.value)}
              placeholder="0"
              inputMode="decimal"
            />
          </div>

          <div className="form-control">
            <label htmlFor="csv-file" className="label text-sm font-medium">
              Archivo CSV
            </label>
            <FileInput id="csv-file" accept=".csv,.txt" onChange={onFile} />
          </div>
        </div>

        {fileName && !uploadError && (
          <div className="bg-success/10 mt-4 flex items-center justify-between rounded-lg px-4 py-3">
            <div className="flex items-center gap-2">
              <FileText className="text-success h-4 w-4" />
              <span className="text-success text-sm font-medium">Archivo cargado: {fileName}</span>
            </div>
            <Button variant="ghost" size="sm" onClick={clearFile}>
              Limpiar
            </Button>
          </div>
        )}

        {uploadError && (
          <div className="mt-4">
            <Alert variant="error">{uploadError}</Alert>
          </div>
        )}
      </div>

      {/* Preview Table */}
      {ledger.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">Vista Previa</h2>
          <ReportTable ledger={ledger} />
        </div>
      )}
    </section>
  );
}
