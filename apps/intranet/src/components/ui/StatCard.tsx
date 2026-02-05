import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

interface StatCardProps {
  /** Additional CSS classes */
  className?: string;
  /** Optional icon to show beside the title */
  icon?: LucideIcon;
  /** Size variant */
  size?: StatCardSize;
  /** Optional helper/subtitle text below the value */
  subtitle?: string;
  /** Optional suffix for the value (e.g., "hrs", "%") */
  suffix?: string;
  /** Title/label shown above the value */
  title: string;
  /** Color tone for the value */
  tone?: StatCardTone;
  /** Main value to display */
  value: number | string;
}
type StatCardSize = "lg" | "md" | "sm";

type StatCardTone = "default" | "error" | "primary" | "success" | "warning";

const toneClasses: Record<StatCardTone, string> = {
  default: "text-foreground",
  error: "text-danger",
  primary: "text-primary",
  success: "text-success",
  warning: "text-warning",
};

const sizeClasses: Record<StatCardSize, { container: string; title: string; value: string }> = {
  lg: {
    container: "p-6",
    title: "text-sm",
    value: "text-3xl font-bold",
  },
  md: {
    container: "p-4",
    title: "text-xs",
    value: "text-2xl font-semibold",
  },
  sm: {
    container: "p-3",
    title: "text-[10px]",
    value: "text-lg font-semibold",
  },
};

/**
 * Unified stat card component for displaying metrics
 * Replaces: StatCard (reports), StatCard (stats), ServicesStatCard, StatMini (inline)
 */
export function StatCard({
  className,
  icon: Icon,
  size = "md",
  subtitle,
  suffix,
  title,
  tone = "default",
  value,
}: Readonly<StatCardProps>) {
  // eslint-disable-next-line security/detect-object-injection
  const sizes = sizeClasses[size];

  return (
    <article
      className={cn(
        "rounded-2xl border border-default-200 bg-background shadow-sm",
        sizes.container,
        className,
      )}
    >
      <p
        className={cn(
          "flex items-center gap-1.5 font-semibold text-default-500 uppercase tracking-wide",
          sizes.title,
        )}
      >
        {Icon && <Icon className="h-4 w-4" />}
        {title}
      </p>
      {/* eslint-disable-next-line security/detect-object-injection */}
      <p className={cn("mt-2", toneClasses[tone], sizes.value)}>
        {value}
        {suffix && <span className="ml-1 font-normal text-default-400 text-sm">{suffix}</span>}
      </p>
      {subtitle && <p className="mt-1 text-default-400 text-xs">{subtitle}</p>}
    </article>
  );
}

export default StatCard;
