import { Breadcrumbs } from "@heroui/react";
import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

interface Breadcrumb {
  label: string;
  to?: string;
}

interface ServicesHeroProps {
  actions?: ReactNode;
  description: string;
  title: string;
  breadcrumbs?: Breadcrumb[];
}

export function ServicesGrid({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-0 items-start gap-6 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
      {children}
    </div>
  );
}

export function ServicesHero({ actions, description, title, breadcrumbs }: ServicesHeroProps) {
  return (
    <header className="flex flex-col gap-4 rounded-[28px] border border-default-100 bg-background p-6 shadow-xl lg:flex-row lg:items-center lg:justify-between">
      <div className="space-y-3">
        {breadcrumbs && breadcrumbs.length > 0 && (
          <Breadcrumbs>
            {breadcrumbs.map((crumb) => (
              <Breadcrumbs.Item key={crumb.label}>
                {crumb.to ? (
                  <Link className="font-medium text-primary" to={crumb.to}>
                    {crumb.label}
                  </Link>
                ) : (
                  crumb.label
                )}
              </Breadcrumbs.Item>
            ))}
          </Breadcrumbs>
        )}
        <div className="space-y-1.5">
          <h1 className="font-semibold text-2xl text-foreground drop-shadow-sm lg:text-3xl">
            {title}
          </h1>
          <p className="text-default-600 text-sm">{description}</p>
        </div>
      </div>
      {actions && <div className="flex flex-wrap justify-end gap-2">{actions}</div>}
    </header>
  );
}

export function ServicesSurface({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`surface-recessed rounded-[28px] p-6 shadow-inner ${className}`}>
      <div className="space-y-6">{children}</div>
    </section>
  );
}
