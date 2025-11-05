import { Link } from "react-router-dom";

function QuickAction({ title, description, to }: { title: string; description: string; to: string }) {
  return (
    <Link
      to={to}
      className="flex h-full flex-col justify-between rounded-2xl border border-base-300 bg-base-100 p-4 text-sm text-base-content transition-all hover:-translate-y-0.5 hover:border-base-300 hover:bg-base-200"
    >
      <div>
        <p className="text-sm font-semibold text-base-content drop-shadow-sm">{title}</p>
        <p className="mt-1 text-xs text-base-content/90">{description}</p>
      </div>
      <span className="mt-3 inline-flex w-fit items-center gap-1 rounded-full border border-primary/30 bg-primary/12 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-primary">
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
