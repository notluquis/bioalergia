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
      ? "border-l-4 border-success/70 text-success"
      : accent === "rose"
        ? "border-l-4 border-error/70 text-error"
        : "border-l-4 border-primary/70 text-primary";

  return (
    <article className={`p-6 text-base-content bg-base-100 ${colorClass}`}>
      <h2 className="text-xs font-semibold uppercase tracking-wide text-base-content/90">{title}</h2>
      <p className="mt-3 text-2xl font-bold tracking-tight">{loading ? "—" : fmtCLP(value)}</p>
    </article>
  );
}
