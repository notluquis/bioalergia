import { fmtCLP } from "../../../lib/format";

interface StatCardProps {
  title: string;
  value: number;
  accent: "emerald" | "rose" | "slate" | string;
}

export default function StatCard({ title, value, accent }: StatCardProps) {
  const colorClass =
    accent === "emerald"
      ? "bg-emerald-100 text-emerald-700"
      : accent === "rose"
        ? "bg-rose-100 text-rose-700"
        : "bg-base-200 text-base-content";

  return (
    <div className={`rounded-2xl p-6 shadow-sm ${colorClass}`}>
      <h3 className="text-sm font-semibold uppercase tracking-wide">{title}</h3>
      <p className="mt-2 text-2xl font-bold">{fmtCLP(value)}</p>
    </div>
  );
}
