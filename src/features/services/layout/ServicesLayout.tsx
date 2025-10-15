import { useEffect, useMemo, useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { fetchServices } from "../../services/api";
import type { ServiceSummary } from "../../services/types";

const NAV_ITEMS = [
  { to: "/services", label: "Resumen" },
  { to: "/services/agenda", label: "Agenda" },
  { to: "/services/plantillas", label: "Plantillas" },
];

export default function ServicesLayout() {
  const navigate = useNavigate();
  const [services, setServices] = useState<ServiceSummary[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchServices()
      .then((response) => {
        if (!cancelled) setServices(response.services);
      })
      .catch(() => {
        if (!cancelled) setServices([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const metrics = useMemo(() => {
    if (!services.length) {
      return {
        active: 0,
        total: 0,
        dueToday: 0,
        overdue: 0,
      };
    }
    let dueToday = 0;
    let overdue = 0;
    services.forEach((service) => {
      dueToday += service.pending_count;
      overdue += service.overdue_count;
    });
    return {
      active: services.filter((service) => service.status === "ACTIVE").length,
      total: services.length,
      dueToday,
      overdue,
    };
  }, [services]);

  return (
    <section className="flex h-full flex-col gap-6">
      <header className="glass-card glass-underlay-gradient border border-white/40 bg-white/80 px-6 py-5 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-1">
            <h1 className="text-2xl font-bold text-[var(--brand-primary)] drop-shadow-sm">Servicios</h1>
            <p className="text-sm text-slate-600/90">Gestiona contratos, vencimientos y plantillas de tus servicios.</p>
          </div>
          <button
            type="button"
            className="rounded-full border border-white/60 bg-white/70 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-[var(--brand-primary)] shadow hover:border-[var(--brand-primary)]/45"
            onClick={() => navigate("/services")}
          >
            Ver resumen actual
          </button>
        </div>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard title="Activos" value={`${metrics.active} / ${metrics.total}`} helper="Servicios en operación" />
        <MetricCard title="Pendientes" value={`${metrics.dueToday}`} helper="Cuotas pendientes totales" />
        <MetricCard title="Vencidos" value={`${metrics.overdue}`} helper="Cuotas vencidas" accent="warning" />
        <MetricCard
          title="Sin datos"
          value={loading ? "…" : `${metrics.total - metrics.active}`}
          helper="En revisión o archivados"
        />
      </div>

      <nav className="glass-card glass-underlay-gradient flex flex-wrap gap-2 border border-white/40 p-3 text-sm text-slate-600">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end
            className={({ isActive }) =>
              `rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide transition-all ${
                isActive
                  ? "bg-[var(--brand-primary)]/15 text-[var(--brand-primary)] shadow-inner"
                  : "border border-white/50 bg-white/70 text-slate-500 hover:border-[var(--brand-primary)]/35 hover:text-[var(--brand-primary)]"
              }`
            }
          >
            {item.label}
          </NavLink>
        ))}
      </nav>

      <Outlet />
    </section>
  );
}

type MetricCardProps = {
  title: string;
  value: string;
  helper?: string;
  accent?: "default" | "warning";
};

function MetricCard({ title, value, helper, accent = "default" }: MetricCardProps) {
  const accentClasses =
    accent === "warning"
      ? "border-amber-300/70 bg-amber-50/60 text-amber-700"
      : "border-white/45 bg-white/70 text-slate-600";
  return (
    <article className={`rounded-2xl border p-4 shadow-sm ${accentClasses}`}>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</p>
      <p className="mt-2 text-2xl font-semibold text-slate-800">{value}</p>
      {helper && <p className="mt-1 text-xs text-slate-400">{helper}</p>}
    </article>
  );
}
