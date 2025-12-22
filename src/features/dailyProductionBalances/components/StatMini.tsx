interface StatMiniProps {
  label: string;
  value: string | number;
  tone?: "primary" | "success" | "error";
  bold?: boolean;
}

export function StatMini({ label, value, tone, bold }: StatMiniProps) {
  const toneClass =
    tone === "primary" ? "text-primary" : tone === "success" ? "text-success" : tone === "error" ? "text-error" : "";

  return (
    <div className="border-base-200 bg-base-100 rounded-lg border p-3 text-center">
      <p className="text-base-content/60 text-xs">{label}</p>
      <p className={`${toneClass} ${bold ? "text-lg font-bold" : "text-sm font-semibold"}`}>{value}</p>
    </div>
  );
}
