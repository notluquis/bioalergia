import { type LucideIcon, TrendingDown, TrendingUp, Wallet } from "lucide-react";

import { fmtCLP } from "@/lib/format";

type Accent = "emerald" | "primary" | "rose";

const ACCENT_THEME: Record<
  Accent,
  {
    badge: string;
    badgeLabel: string;
    gradient: string;
    icon: LucideIcon;
    iconColor: string;
    ring: string;
    value: string;
  }
> = {
  emerald: {
    badge: "bg-success/10 text-success",
    badgeLabel: "Ingresos",
    gradient: "from-success/20 via-success/5 to-transparent",
    icon: TrendingUp,
    iconColor: "text-success",
    ring: "ring-success/20",
    value: "text-success",
  },
  primary: {
    badge: "bg-primary/10 text-primary",
    badgeLabel: "Resultado",
    gradient: "from-primary/20 via-primary/5 to-transparent",
    icon: Wallet,
    iconColor: "text-primary",
    ring: "ring-primary/20",
    value: "text-primary",
  },
  rose: {
    badge: "bg-danger/10 text-danger",
    badgeLabel: "Egresos",
    gradient: "from-error/20 via-error/5 to-transparent",
    icon: TrendingDown,
    iconColor: "text-danger",
    ring: "ring-error/20",
    value: "text-danger",
  },
};

export default function MetricCard({
  accent,
  loading,
  title,
  value,
}: {
  accent: Accent;
  loading: boolean;
  title: string;
  value: number;
}) {
  const theme = ACCENT_THEME[accent];
  const Icon = theme.icon;

  return (
    <article
      className={`relative overflow-hidden rounded-4xl bg-linear-to-br ${theme.gradient} p-6 shadow-lg ring-1 ring-inset transition-all duration-300 hover:-translate-y-1 hover:shadow-xl ${theme.ring}`}
    >
      <div
        aria-hidden="true"
        className={`pointer-events-none absolute inset-0 rounded-3xl bg-linear-to-br ${theme.gradient}`}
      />
      <div className="relative flex flex-col gap-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-full bg-background/50 ring-1 ring-inset backdrop-blur-sm ${theme.ring}`}
            >
              <Icon className={`h-4 w-4 ${theme.iconColor}`} />
            </div>
            <h2 className="typ-caption text-default-600">{title}</h2>
          </div>
          <span
            className={`hidden rounded-full px-3 py-1 font-semibold text-[11px] uppercase tracking-wide lg:inline-flex ${theme.badge}`}
          >
            {theme.badgeLabel}
          </span>
        </div>
        <p className={`typ-subtitle ${theme.value} pl-1`}>{loading ? "—" : fmtCLP(value)}</p>
      </div>
    </article>
  );
}
