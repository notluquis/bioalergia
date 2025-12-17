import { fmtCLP } from "@/lib/format";
import { TrendingUp, TrendingDown, Wallet, type LucideIcon } from "lucide-react";

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
    gradient: "from-emerald-400/30 via-emerald-400/15 to-transparent",
    ring: "ring-emerald-400/25",
    value: "text-emerald-700 dark:text-emerald-400",
    badge: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
    badgeLabel: "Ingresos",
    icon: TrendingUp,
    iconColor: "text-emerald-600 dark:text-emerald-400",
  },
  rose: {
    gradient: "from-rose-400/30 via-rose-400/15 to-transparent",
    ring: "ring-rose-400/25",
    value: "text-rose-700 dark:text-rose-400",
    badge: "bg-rose-500/15 text-rose-700 dark:text-rose-300",
    badgeLabel: "Egresos",
    icon: TrendingDown,
    iconColor: "text-rose-600 dark:text-rose-400",
  },
  primary: {
    gradient: "from-blue-400/30 via-blue-400/15 to-transparent",
    ring: "ring-blue-400/25",
    value: "text-blue-700 dark:text-blue-400",
    badge: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
    badgeLabel: "Resultado",
    icon: Wallet,
    iconColor: "text-blue-600 dark:text-blue-400",
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
