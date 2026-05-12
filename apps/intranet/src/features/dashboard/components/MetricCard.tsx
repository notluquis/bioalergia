import { Card } from "@heroui/react";
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
    gradient: "from-danger/20 via-danger/5 to-transparent",
    icon: TrendingDown,
    iconColor: "text-danger",
    ring: "ring-danger/20",
    value: "text-danger",
  },
};
export function MetricCard({
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
    <Card
      className={`relative overflow-hidden rounded-[30px] border border-default-200/70 bg-background shadow-sm ring-1 ring-inset ${theme.ring}`}
    >
      <div
        aria-hidden="true"
        className={`pointer-events-none absolute inset-0 bg-linear-to-br ${theme.gradient}`}
      />

      <Card.Content className="relative flex min-h-28 flex-col gap-3 p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <div
              className={`flex h-10 w-10 items-center justify-center rounded-2xl bg-background/80 ring-1 ring-inset backdrop-blur-sm ${theme.ring}`}
            >
              <Icon className={`h-4 w-4 ${theme.iconColor}`} />
            </div>
            <div className="space-y-1">
              <h2 className="font-medium text-default-700 text-xl/none">{title}</h2>
              <p className="text-default-500 text-xs">Resumen del periodo actual</p>
            </div>
          </div>
          <span
            className={`inline-flex rounded-full px-3 py-1 font-semibold text-[11px] ${theme.badge}`}
          >
            {theme.badgeLabel}
          </span>
        </div>
        <p className={`font-semibold text-3xl leading-none tracking-tight ${theme.value}`}>
          {loading ? "—" : fmtCLP(value)}
        </p>
      </Card.Content>
    </Card>
  );
}
