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
  const accentStyles =
    accent === "emerald"
      ? { border: "border-l-4 border-success/60", text: "text-success", chip: "bg-success/15 text-success" }
      : accent === "rose"
        ? { border: "border-l-4 border-error/60", text: "text-error", chip: "bg-error/15 text-error" }
        : { border: "border-l-4 border-primary/60", text: "text-primary", chip: "bg-primary/15 text-primary" };

  return (
    <article className={`surface-recessed relative overflow-hidden p-6 text-base-content ${accentStyles.border}`}>
      <h2 className="typ-caption text-base-content/70">{title}</h2>
      <p className={`mt-3 typ-subtitle ${accentStyles.text}`}>{loading ? "—" : fmtCLP(value)}</p>
      <span
        className={`absolute inset-y-4 right-5 hidden rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-wide ${accentStyles.chip} lg:inline-flex`}
      >
        {accent === "emerald" ? "Ingresos" : accent === "rose" ? "Egresos" : "Resultado"}
      </span>
    </article>
  );
}
