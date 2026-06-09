// oxlint-disable typescript/no-non-null-assertion -- TODO(strict-null): refactor each `!` to invariant() or explicit guard. Tracked in repo-wide non-null cleanup.
import { AlertCircle, Check, CheckCheck, Clock } from "lucide-react";
import { addDays, chileDay, type DateInput, diffDays, formatChile, today } from "@/lib/dates";

export const QUICK_REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "🙏"];

export type MessageStatus = "SENT" | "DELIVERED" | "READ" | "FAILED" | "PENDING";

export function StatusTicks({ status }: { status: MessageStatus }) {
  const cls = "inline-block";
  if (status === "PENDING") return <Clock className={cls} size={14} aria-label="enviando" />;
  if (status === "FAILED")
    return <AlertCircle className={`${cls} text-danger`} size={14} aria-label="falló" />;
  if (status === "READ")
    return <CheckCheck className={`${cls} text-accent`} size={14} aria-label="leído" />;
  if (status === "DELIVERED")
    return <CheckCheck className={cls} size={14} aria-label="entregado" />;
  return <Check className={cls} size={14} aria-label="enviado" />;
}

export function dayLabel(value: DateInput): string {
  const day = chileDay(value);
  const t = today();
  if (day === t) return "Hoy";
  if (day === addDays(t, -1)) return "Ayer";
  if (diffDays(t, day) < 7) return formatChile(value, "dddd");
  return formatChile(value, "DD MMM YYYY");
}

export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}
