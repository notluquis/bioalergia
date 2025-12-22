import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type StatCardTone = "default" | "primary" | "success" | "error" | "warning";
type StatCardSize = "sm" | "md" | "lg";

interface StatCardProps {
  /** Title/label shown above the value */
  title: string;
  /** Main value to display */
  value: string | number;
  /** Optional helper/subtitle text below the value */
  subtitle?: string;
  /** Optional icon to show beside the title */
  icon?: LucideIcon;
  /** Color tone for the value */
  tone?: StatCardTone;
  /** Size variant */
  size?: StatCardSize;
  /** Additional CSS classes */
  className?: string;
  /** Optional suffix for the value (e.g., "hrs", "%") */
  suffix?: string;
}

const toneClasses: Record<StatCardTone, string> = {
  default: "text-base-content",
  primary: "text-primary",
  success: "text-success",
  error: "text-error",
  warning: "text-warning",
};

const sizeClasses: Record<StatCardSize, { container: string; value: string; title: string }> = {
  sm: {
    container: "p-3",
    value: "text-lg font-semibold",
    title: "text-[10px]",
  },
  md: {
    container: "p-4",
    value: "text-2xl font-semibold",
    title: "text-xs",
  },
  lg: {
    container: "p-6",
    value: "text-3xl font-bold",
    title: "text-sm",
  },
};

/**
 * Unified stat card component for displaying metrics
 * Replaces: StatCard (reports), StatCard (stats), ServicesStatCard, StatMini (inline)
 */
export function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  tone = "default",
  size = "md",
  className,
  suffix,
}: StatCardProps) {
  const sizes = sizeClasses[size];

  return (
    <article className={cn("border-base-300 bg-base-100 rounded-2xl border shadow-sm", sizes.container, className)}>
      <p
        className={cn(
          "text-base-content/60 flex items-center gap-1.5 font-semibold tracking-wide uppercase",
          sizes.title
        )}
      >
        {Icon && <Icon className="h-4 w-4" />}
        {title}
      </p>
      <p className={cn("mt-2", toneClasses[tone], sizes.value)}>
        {value}
        {suffix && <span className="text-base-content/50 ml-1 text-sm font-normal">{suffix}</span>}
      </p>
      {subtitle && <p className="text-base-content/50 mt-1 text-xs">{subtitle}</p>}
    </article>
  );
}

export default StatCard;
