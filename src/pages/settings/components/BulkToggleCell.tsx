import { CheckCheck, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Role } from "../RolesSettingsPage";

export function BulkToggleCell({
  role,
  permissionIds,
  isUpdating,
  onToggle,
  variant = "section",
}: {
  role: Role;
  permissionIds: number[];
  isUpdating: boolean;
  onToggle: (role: Role, ids: number[]) => void;
  variant?: "section" | "page";
}) {
  const currentPermissionIds = role.permissions.map((p) => p.permissionId);
  const allPresent = permissionIds.every((id) => currentPermissionIds.includes(id));

  if (permissionIds.length === 0) return <td />;

  return (
    <td className="p-0 text-center align-middle">
      <button
        onClick={() => onToggle(role, permissionIds)}
        disabled={isUpdating}
        title={allPresent ? "Desmarcar todos" : "Marcar todos"}
        className={cn(
          "mx-auto flex h-8 w-8 items-center justify-center rounded-md transition-colors",
          variant === "section"
            ? "text-base-content/50 hover:text-base-content"
            : "text-base-content/40 hover:text-primary",
          allPresent && "text-primary bg-primary/5 font-bold"
        )}
      >
        {isUpdating ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : (
          <CheckCheck size={14} className={allPresent ? "opacity-100" : "opacity-40"} />
        )}
      </button>
    </td>
  );
}
