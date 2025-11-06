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
  }
> = {
  emerald: {
    gradient: "from-emerald-400/30 via-emerald-400/15 to-transparent",
    ring: "ring-emerald-400/25",
    value: "text-emerald-500 dark:text-emerald-300",
    badge: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300",
    badgeLabel: "Ingresos",
  },
  rose: {
    gradient: "from-rose-400/30 via-rose-400/15 to-transparent",
    ring: "ring-rose-400/25",
    value: "text-rose-500 dark:text-rose-300",
    badge: "bg-rose-500/15 text-rose-600 dark:text-rose-300",
    badgeLabel: "Egresos",
  },
  primary: {
    gradient: "from-primary/30 via-primary/15 to-transparent",
    ring: "ring-primary/25",
    value: "text-primary",
    badge: "bg-primary/15 text-primary",
    badgeLabel: "Resultado",
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

  return (
    <article
      className={`relative overflow-hidden rounded-3xl border border-base-300/60 bg-base-100/80 p-6 shadow-sm ring-1 ring-inset ${theme.ring}`}
    >
      <div
        className={`pointer-events-none absolute inset-0 rounded-3xl bg-gradient-to-br ${theme.gradient}`}
        aria-hidden="true"
      />
      <div className="relative flex flex-col gap-3">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="typ-caption text-base-content/70">{title}</h2>
          <span
            className={`hidden rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-wide lg:inline-flex ${theme.badge}`}
          >
            {theme.badgeLabel}
          </span>
        </div>
        <p className={`typ-subtitle ${theme.value}`}>{loading ? "—" : fmtCLP(value)}</p>
      </div>
    </article>
  );
}
