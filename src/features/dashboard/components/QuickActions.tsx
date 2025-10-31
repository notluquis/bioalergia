import { Link } from "react-router-dom";

function QuickAction({ title, description, to }: { title: string; description: string; to: string }) {
  return (
    <Link
      to={to}
      className="flex h-full flex-col justify-between rounded-2xl border border-white/60 bg-base-100 p-4 text-sm text-slate-600 transition-all hover:-translate-y-0.5 hover:border-white/75 hover:bg-base-100/75"
    >
      <div>
        <p className="text-sm font-semibold text-slate-700 drop-shadow-sm">{title}</p>
        <p className="mt-1 text-xs text-slate-500/90">{description}</p>
      </div>
      <span className="mt-3 inline-flex w-fit items-center gap-1 rounded-full border border-[var(--brand-primary)]/30 bg-[var(--brand-primary)]/12 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--brand-primary)]">
        Ir
      </span>
    </Link>
  );
}

export default function QuickActions() {
  return (
    <article className="grid gap-4 p-6 sm:grid-cols-3 bg-base-100">
      <QuickAction title="Subir CSV" description="Pasa nuevos movimientos a la base" to="/upload" />
      <QuickAction title="Registrar saldo" description="Actualiza saldos diarios" to="/transactions/balances" />
      <QuickAction title="Retiros" description="Consulta participantes y retiros" to="/transactions/participants" />
    </article>
  );
}
