import { fmtCLP } from "../../../lib/format";

interface StatCardProps {
  title: string;
  value: number;
  accent: "success" | "error" | "warning" | "default";
}

export default function StatCard({ title, value, accent }: StatCardProps) {
  const colorClass =
    accent === "success"
      ? "bg-success/10 text-success border-l-4 border-success/30"
      : accent === "error"
        ? "bg-error/10 text-error border-l-4 border-error/30"
        : accent === "warning"
          ? "bg-warning/10 text-warning border-l-4 border-warning/30"
          : "bg-base-200 text-base-content";

  return (
    <div className={`rounded-2xl p-6 shadow-sm ${colorClass}`}>
      <h3 className="text-sm font-semibold uppercase tracking-wide">{title}</h3>
      <p className="mt-2 text-2xl font-bold">{fmtCLP(value)}</p>
    </div>
  );
}
