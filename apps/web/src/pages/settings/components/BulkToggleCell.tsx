import { CheckCheck, Loader2, Minus } from "lucide-react";

import { Role } from "@/types/roles";

export function BulkToggleCell({
  role,
  permissionIds,
  isUpdating,
  onToggle,
  className,
}: {
  role: Role;
  permissionIds: number[];
  isUpdating: boolean;
  onToggle: (role: Role, ids: number[]) => void;
  variant?: "section" | "page"; // Deprecated but kept for compatibility
  className?: string;
}) {
  const currentPermissionIds = role.permissions.map((p) => p.permissionId);
  const presentCount = permissionIds.filter((id) => currentPermissionIds.includes(id)).length;
  const allPresent = permissionIds.length > 0 && presentCount === permissionIds.length;
  const somePresent = presentCount > 0 && presentCount < permissionIds.length;

  if (permissionIds.length === 0) return <td className={className} />;

  return (
    <td className={`p-0 text-center align-middle ${className || ""}`}>
      <button
        onClick={() => onToggle(role, permissionIds)}
        disabled={isUpdating}
        title={allPresent ? "Desmarcar todos" : "Marcar todos"}
        className="mx-auto flex h-8 w-full items-center justify-center rounded-md transition-colors"
      >
        {isUpdating ? (
          <Loader2 className="text-base-content/40 h-4 w-4 animate-spin" />
        ) : allPresent ? (
          <div className="bg-primary hover:bg-primary-focus flex h-5 w-5 items-center justify-center rounded-md shadow-sm transition-transform active:scale-95">
            <CheckCheck size={12} className="text-primary-content" />
          </div>
        ) : somePresent ? (
          <div className="bg-primary/70 hover:bg-primary flex h-5 w-5 items-center justify-center rounded-md shadow-sm transition-transform active:scale-95">
            <Minus size={12} className="text-primary-content" />
          </div>
        ) : (
          <div className="border-base-300 hover:border-primary/50 hover:bg-primary/5 h-5 w-5 rounded-md border-2 transition-colors" />
        )}
      </button>
    </td>
  );
}
