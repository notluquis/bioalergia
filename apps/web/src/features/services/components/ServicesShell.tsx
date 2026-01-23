import type { ReactNode } from "react";

interface ServicesHeroProps {
  actions?: ReactNode;
  description: string;
  title: string;
}

export function ServicesGrid({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-0 items-start gap-6 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
      {children}
    </div>
  );
}

export function ServicesHero({ actions, description, title }: ServicesHeroProps) {
  return (
    <header className="surface-elevated flex flex-col gap-4 rounded-[28px] p-6 shadow-xl lg:flex-row lg:items-center lg:justify-between">
      <div className="space-y-3">
        <div className="space-y-1.5">
          <h1 className="text-base-content text-2xl font-semibold drop-shadow-sm lg:text-3xl">
            {title}
          </h1>
          <p className="text-base-content/70 text-sm">{description}</p>
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
