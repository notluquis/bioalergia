import { type LucideIcon, TrendingDown, TrendingUp, Wallet } from "lucide-react";

import { fmtCLP } from "@/lib/format";

type Accent = "emerald" | "rose" | "primary";

const ACCENT_THEME: Record<
  Accent,
  {
    gradient: string;
    ring: string;
    value: string;
    badge: string;
    badgeLabel: string;
    icon: LucideIcon;
    iconColor: string;
  }
> = {
  emerald: {
    gradient: "from-success/20 via-success/5 to-transparent",
    ring: "ring-success/20",
    value: "text-success",
    badge: "bg-success/10 text-success",
    badgeLabel: "Ingresos",
    icon: TrendingUp,
    iconColor: "text-success",
  },
  rose: {
    gradient: "from-error/20 via-error/5 to-transparent",
    ring: "ring-error/20",
    value: "text-error",
    badge: "bg-error/10 text-error",
    badgeLabel: "Egresos",
    icon: TrendingDown,
    iconColor: "text-error",
  },
  primary: {
    gradient: "from-primary/20 via-primary/5 to-transparent",
    ring: "ring-primary/20",
    value: "text-primary",
    badge: "bg-primary/10 text-primary",
    badgeLabel: "Resultado",
    icon: Wallet,
    iconColor: "text-primary",
  },
};

export default function MetricCard({
  title,
  value,
  accent,
  loading,
}: {
  title: string;
  value: number;
  accent: Accent;
  loading: boolean;
}) {
  const theme = ACCENT_THEME[accent];
  const Icon = theme.icon;

  return (
    <article
      className={`relative overflow-hidden rounded-4xl bg-linear-to-br ${theme.gradient} p-6 shadow-lg ring-1 transition-all duration-300 ring-inset hover:-translate-y-1 hover:shadow-xl ${theme.ring}`}
    >
      <div
        className={`pointer-events-none absolute inset-0 rounded-3xl bg-linear-to-br ${theme.gradient}`}
        aria-hidden="true"
      />
      <div className="relative flex flex-col gap-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <div
              className={`bg-base-100/50 flex h-8 w-8 items-center justify-center rounded-full ring-1 backdrop-blur-sm ring-inset ${theme.ring}`}
            >
              <Icon className={`h-4 w-4 ${theme.iconColor}`} />
            </div>
            <h2 className="typ-caption text-base-content/70">{title}</h2>
          </div>
          <span
            className={`hidden rounded-full px-3 py-1 text-[11px] font-semibold tracking-wide uppercase lg:inline-flex ${theme.badge}`}
          >
            {theme.badgeLabel}
          </span>
        </div>
        <p className={`typ-subtitle ${theme.value} pl-1`}>{loading ? "—" : fmtCLP(value)}</p>
      </div>
    </article>
  );
}
