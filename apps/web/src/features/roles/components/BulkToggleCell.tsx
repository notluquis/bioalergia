import { CheckCheck, Loader2, Minus } from "lucide-react";

import type { Role } from "@/types/roles";

export function BulkToggleCell({
  className,
  isUpdating,
  onToggle,
  permissionIds,
  role,
}: {
  className?: string;
  isUpdating: boolean;
  onToggle: (role: Role, ids: number[]) => void;
  permissionIds: number[];
  role: Role;
  variant?: "page" | "section"; // Deprecated but kept for compatibility
}) {
  const currentPermissionIds = new Set(role.permissions.map((p) => p.permissionId));
  const presentCount = permissionIds.filter((id) => currentPermissionIds.has(id)).length;
  const allPresent = permissionIds.length > 0 && presentCount === permissionIds.length;
  const somePresent = presentCount > 0 && presentCount < permissionIds.length;

  const renderIcon = () => {
    if (isUpdating) {
      return <Loader2 className="text-base-content/40 h-4 w-4 animate-spin" />;
    }
    if (allPresent) {
      return (
        <div className="bg-primary hover:bg-primary-focus flex h-5 w-5 items-center justify-center rounded-md shadow-sm transition-transform active:scale-95">
          <CheckCheck className="text-primary-content" size={12} />
        </div>
      );
    }
    if (somePresent) {
      return (
        <div className="bg-primary/70 hover:bg-primary flex h-5 w-5 items-center justify-center rounded-md shadow-sm transition-transform active:scale-95">
          <Minus className="text-primary-content" size={12} />
        </div>
      );
    }
    return (
      <div className="border-base-300 hover:border-primary/50 hover:bg-primary/5 h-5 w-5 rounded-md border-2 transition-colors" />
    );
  };

  if (permissionIds.length === 0) return <div className={className} />;

  return (
    <div className={`flex items-center justify-center p-0 text-center ${className || ""}`}>
      <button
        className="mx-auto flex h-8 w-full items-center justify-center rounded-md transition-colors"
        disabled={isUpdating}
        onClick={() => {
          onToggle(role, permissionIds);
        }}
        title={allPresent ? "Desmarcar todos" : "Marcar todos"}
        type="button"
      >
        {renderIcon()}
      </button>
    </div>
  );
}
