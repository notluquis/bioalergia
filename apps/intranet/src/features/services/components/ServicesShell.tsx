import type { ReactNode } from "react";

export function ServicesGrid({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-0 items-start gap-6 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
      {children}
    </div>
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
