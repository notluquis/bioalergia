import { CheckCircle, Loader2, XCircle } from "lucide-react";

export const StatusBadge = ({ status }: { status: string }) => {
  const s = status.toUpperCase();
  if (s === "SUCCESS") {
    return (
      <span className="badge badge-success gap-1 text-xs font-semibold">
        <CheckCircle className="h-3 w-3" /> Exitoso
      </span>
    );
  }
  if (s === "ERROR" || s === "FAILED") {
    return (
      <span className="badge badge-error gap-1 text-xs font-semibold">
        <XCircle className="h-3 w-3" /> Error
      </span>
    );
  }
  return (
    <span className="badge badge-warning gap-1 text-xs font-semibold">
      <Loader2 className="h-3 w-3 animate-spin" /> {status}
    </span>
  );
};
