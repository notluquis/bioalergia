import { CheckCheck, Loader2 } from "lucide-react";
import { Role } from "@/types/roles";

export function BulkToggleCell({
  role,
  permissionIds,
  isUpdating,
  onToggle,
}: {
  role: Role;
  permissionIds: number[];
  isUpdating: boolean;
  onToggle: (role: Role, ids: number[]) => void;
  variant?: "section" | "page"; // Deprecated but kept for compatibility
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
        className="mx-auto flex h-8 w-8 items-center justify-center rounded-md transition-colors"
      >
        {isUpdating ? (
          <Loader2 className="text-base-content/40 h-3 w-3 animate-spin" />
        ) : allPresent ? (
          <div className="bg-primary hover:bg-primary-focus flex h-5 w-5 items-center justify-center rounded shadow-sm transition-transform active:scale-95">
            <CheckCheck size={12} className="text-primary-content" />
          </div>
        ) : (
          <div className="border-base-300 hover:border-primary/50 hover:bg-primary/5 h-5 w-5 rounded border-2 transition-colors" />
        )}
      </button>
    </td>
  );
}
