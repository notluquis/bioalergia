import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatCardProps {
  title: string;
  value: string | number;
  subtext?: string;
  icon: LucideIcon;
  className?: string;
  suffix?: string;
}

/**
 * StatCard component for displaying report metrics
 */
export function StatCard({ title, value, subtext, icon: Icon, className, suffix }: StatCardProps) {
  return (
    <div className="bg-base-100 border-base-200 relative overflow-hidden rounded-2xl border p-4 shadow-sm transition-shadow hover:shadow-md">
      <div className="mb-2 flex items-start justify-between">
        <span className="text-base-content/50 text-xs font-bold tracking-wider uppercase">{title}</span>
        <div
          className={cn(
            "bg-base-200/50 rounded-full p-2",
            className?.replace("text-", "bg-").replace("500", "100") + "/10"
          )}
        >
          <Icon className={cn("h-4 w-4", className)} />
        </div>
      </div>
      <div className="flex items-baseline gap-1">
        <span className={cn("text-2xl font-black tracking-tight", className)}>{value}</span>
        {suffix && <span className="text-base-content/40 text-sm font-medium">{suffix}</span>}
      </div>
      {subtext && (
        <div className="text-base-content/60 mt-1 truncate text-xs" title={subtext}>
          {subtext}
        </div>
      )}
    </div>
  );
}
