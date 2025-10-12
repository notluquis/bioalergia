import { useMemo, useState } from "react";
import type { ChangeEvent } from "react";
import { coerceAmount } from "../lib/format";
import { useReportUpload } from "../features/reports/hooks/useReportUpload";
import ReportTable from "../features/reports/components/ReportTable";
import Input from "../components/Input";
import FileInput from "../components/FileInput";
import Alert from "../components/Alert";

export default function Report() {
  const [initialBalance, setInitialBalance] = useState<string>("0");
  const { movs, fileName, error: uploadError, onFile } = useReportUpload();

  const initialBalanceNumber = useMemo(() => coerceAmount(initialBalance), [initialBalance]);

  const ledger = useMemo(() => {
    let balance = initialBalanceNumber;
    return movs.map((m) => {
      const delta = m.direction === "IN" ? m.amount : m.direction === "OUT" ? -m.amount : 0;
      balance += delta;
      return { ...m, runningBalance: balance, delta };
    });
  }, [movs, initialBalanceNumber]);

  return (
    <section className="space-y-6">
      <div className="glass-card glass-underlay-gradient space-y-2 p-6">
        <h1 className="text-2xl font-bold text-[var(--brand-primary)] drop-shadow-sm">Reporte financiero</h1>
        <p className="text-sm text-slate-600/90">
          Visualiza y valida un CSV antes de cargarlo en la base. Ajusta el saldo inicial para obtener la evolución al
          instante.
        </p>
      </div>
      <div className="glass-card glass-underlay-gradient space-y-3 p-6 text-sm">
        <p>
          Genera el <strong>Account balance report</strong> desde el panel de Mercado Pago y súbelo para ver los
          movimientos IN/OUT.
        </p>
        <ul className="list-disc space-y-1 pl-5 text-xs text-slate-500/90">
          <li>Dashboard &rarr; Reports &rarr; Finanzas &rarr; Account balance report.</li>
          <li>Descarga el archivo en CSV (o formato delimitado compatible) y cárgalo aquí.</li>
        </ul>
        <div className="grid gap-3 md:grid-cols-2">
          <Input
            label="Saldo inicial (CLP)"
            type="text"
            value={initialBalance}
            onChange={(event: ChangeEvent<HTMLInputElement>) => setInitialBalance(event.target.value)}
            placeholder="0"
          />
          <FileInput label="Archivo CSV" accept=".csv,.txt" onChange={onFile} />
        </div>
        {fileName && !uploadError && <p className="text-xs text-slate-500/90">Archivo cargado: {fileName}</p>}
        {uploadError && <Alert variant="error">{uploadError}</Alert>}
      </div>
      <ReportTable ledger={ledger} />
    </section>
  );
}
