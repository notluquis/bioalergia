import { Chip } from "@heroui/react";
import { CheckCircle, Loader2, XCircle } from "lucide-react";

export const StatusBadge = ({ status }: { status: string }) => {
  const s = status.toUpperCase();
  if (s === "SUCCESS") {
    return (
      <Chip className="gap-1 font-semibold text-xs" color="success" size="sm" variant="soft">
        <CheckCircle className="h-3 w-3" /> Exitoso
      </Chip>
    );
  }
  if (s === "ERROR" || s === "FAILED") {
    return (
      <Chip className="gap-1 font-semibold text-xs" color="danger" size="sm" variant="soft">
        <XCircle className="h-3 w-3" /> Error
      </Chip>
    );
  }
  return (
    <Chip className="gap-1 font-semibold text-xs" color="warning" size="sm" variant="soft">
      <Loader2 className="h-3 w-3 animate-spin" /> {status}
    </Chip>
  );
};
