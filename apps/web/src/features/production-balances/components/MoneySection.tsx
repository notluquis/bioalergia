import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

interface MoneySectionProps {
  children: ReactNode;
  className?: string;
  icon?: ReactNode;
  title: string;
}

/**
 * Section wrapper for money input groups
 */
export function MoneySection({ children, className, icon, title }: MoneySectionProps) {
  return (
    <section
      className={cn("bg-default-50/30 border-default-100 rounded-2xl border p-4", className)}
    >
      <div className="mb-4 flex items-center gap-2">
        {icon && <span className="text-default-500">{icon}</span>}
        <h3 className="text-base font-semibold">{title}</h3>
      </div>
      {children}
    </section>
  );
}
