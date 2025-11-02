import { fmtCLP } from "@/lib/format";

export default function MetricCard({
  title,
  value,
  accent,
  loading,
}: {
  title: string;
  value: number;
  accent: "emerald" | "rose" | "primary";
  loading: boolean;
}) {
  const colorClass =
    accent === "emerald"
      ? "border-l-4 border-emerald-300/80 text-emerald-700 bg-gradient-to-br from-emerald-50/75 via-white/70 to-white/55"
      : accent === "rose"
        ? "border-l-4 border-rose-300/80 text-rose-700 bg-gradient-to-br from-rose-50/75 via-white/70 to-white/55"
        : "border-l-4 border-(--brand-primary)/70 text-(--brand-primary) bg-gradient-to-br from-[rgba(14,100,183,0.15)] via-white/70 to-white/55";

  return (
    <article className={`p-6 text-base-content bg-base-100 ${colorClass}`}>
      <h2 className="text-xs font-semibold uppercase tracking-wide text-base-content/90">{title}</h2>
      <p className="mt-3 text-2xl font-bold tracking-tight">{loading ? "—" : fmtCLP(value)}</p>
    </article>
  );
}
