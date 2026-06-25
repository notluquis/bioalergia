import type { ReactNode } from "react";

/**
 * Eyebrow — uppercase brand-blue label, 12px, tracking .16em (handoff). On the
 * deep anchor band it switches to amber via `tone="amber"`.
 */
export function Eyebrow({
  tone = "blue",
  className = "",
  children,
}: {
  tone?: "blue" | "amber" | "muted";
  className?: string;
  children: ReactNode;
}) {
  const color =
    tone === "amber" ? "text-brand-amber" : tone === "muted" ? "text-muted" : "text-eyebrow";
  return (
    <p
      className={`font-bold text-[0.75rem] uppercase leading-none tracking-[0.16em] ${color} ${className}`}
    >
      {children}
    </p>
  );
}
