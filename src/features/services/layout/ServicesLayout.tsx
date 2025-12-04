import { useEffect, useMemo, useState } from "react";
import { NavLink, Outlet, useNavigate, useLocation } from "react-router-dom";
import { Loader2 } from "lucide-react";
import Button from "../../../components/ui/Button";
import { fetchServices } from "../../services/api";
import type { ServiceSummary } from "../../services/types";

import { ServicesProvider } from "../hooks/useServicesOverview";

const NAV_ITEMS = [
  { to: "/services", label: "Resumen" },
  { to: "/services/agenda", label: "Agenda" },
  { to: "/services/create", label: "Crear" },
];

function ServicesLayoutContent() {
  const navigate = useNavigate();
  const location = useLocation();
  const [pendingPath, setPendingPath] = useState<string | null>(null);
  const [services, setServices] = useState<ServiceSummary[]>([]);
  const [loading, setLoading] = useState(false);

  // Clear pending state when location changes (navigation completed)
  useEffect(() => {
    setPendingPath(null);
  }, [location.pathname]);

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
      <header className="border border-base-300 bg-base-100 px-6 py-5 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-1">
            <h1 className="text-2xl font-bold text-primary drop-shadow-sm">Servicios</h1>
            <p className="text-sm text-base-content">Gestiona contratos, vencimientos y plantillas de tus servicios.</p>
          </div>
          <Button type="button" variant="primary" onClick={() => navigate("/services/create")}>
            Nuevo servicio
          </Button>
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

      <nav className="flex flex-wrap gap-3 border border-base-300 p-3 text-sm text-base-content bg-base-100">
        {NAV_ITEMS.map((item) => {
          const isPending = pendingPath === item.to;
          const isCurrentPath = location.pathname === item.to;

          return (
            <NavLink
              key={item.to}
              to={item.to}
              end
              onClick={() => {
                if (!isCurrentPath) setPendingPath(item.to);
              }}
              className={({ isActive }) => {
                const active = isActive || isPending;
                return `flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-semibold uppercase tracking-wide transition-all ${
                  active
                    ? "bg-primary/15 text-primary shadow-inner"
                    : "border border-base-300 bg-base-200 text-base-content/60 hover:border-primary/35 hover:text-primary"
                }`;
              }}
            >
              {item.label}
              {isPending && <Loader2 className="h-3 w-3 animate-spin" />}
            </NavLink>
          );
        })}
      </nav>

      <Outlet />
    </section>
  );
}

export default function ServicesLayout() {
  return (
    <ServicesProvider>
      <ServicesLayoutContent />
    </ServicesProvider>
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
      : "border-base-300 bg-base-200 text-base-content";
  return (
    <article className={`rounded-2xl border p-4 shadow-sm ${accentClasses}`}>
      <p className="text-xs font-semibold uppercase tracking-wide text-base-content/60">{title}</p>
      <p className="mt-2 text-2xl font-semibold text-base-content">{value}</p>
      {helper && <p className="mt-1 text-xs text-base-content/50">{helper}</p>}
    </article>
  );
}
