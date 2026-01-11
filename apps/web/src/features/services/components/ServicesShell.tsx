import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

type Breadcrumb = { label: string; to?: string };

type ServicesHeroProps = {
  title: string;
  description: string;
  breadcrumbs?: Breadcrumb[];
  actions?: ReactNode;
};

export function ServicesHero({ title, description, breadcrumbs, actions }: ServicesHeroProps) {
  return (
    <header className="surface-elevated flex flex-col gap-4 rounded-[28px] p-6 shadow-xl lg:flex-row lg:items-center lg:justify-between">
      <div className="space-y-3">
        {breadcrumbs && breadcrumbs.length > 0 && (
          <nav
            aria-label="Ruta de navegación"
            className="text-base-content/60 flex flex-wrap items-center gap-1 text-xs"
          >
            {breadcrumbs.map((crumb, index) => (
              <span key={crumb.label} className="flex items-center gap-1">
                {crumb.to ? (
                  <Link to={crumb.to} className="text-primary font-semibold">
                    {crumb.label}
                  </Link>
                ) : (
                  <span className="text-base-content/80 font-semibold">{crumb.label}</span>
                )}
                {index < breadcrumbs.length - 1 && <span className="text-base-content/40">/</span>}
              </span>
            ))}
          </nav>
        )}
        <div className="space-y-1.5">
          <h1 className="text-base-content text-2xl font-semibold drop-shadow-sm lg:text-3xl">{title}</h1>
          <p className="text-base-content/70 text-sm">{description}</p>
        </div>
      </div>
      {actions && <div className="flex flex-wrap justify-end gap-2">{actions}</div>}
    </header>
  );
}

export function ServicesSurface({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <section className={`surface-recessed rounded-[28px] p-6 shadow-inner ${className}`}>
      <div className="space-y-6">{children}</div>
    </section>
  );
}

export function ServicesGrid({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-0 items-start gap-6 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">{children}</div>
  );
}
