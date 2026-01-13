import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

interface MoneySectionProps {
  title: string;
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
}

/**
 * Section wrapper for money input groups
 */
export function MoneySection({ title, icon, children, className }: MoneySectionProps) {
  return (
    <section className={cn("bg-base-200/30 border-base-content/5 rounded-2xl border p-4", className)}>
      <div className="mb-4 flex items-center gap-2">
        {icon && <span className="text-base-content/60">{icon}</span>}
        <h3 className="text-base font-semibold">{title}</h3>
      </div>
      {children}
    </section>
  );
}
