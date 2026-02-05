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
      return <Loader2 className="h-4 w-4 animate-spin text-default-300" />;
    }
    if (allPresent) {
      return (
        <div className="flex h-5 w-5 items-center justify-center rounded-md bg-primary shadow-sm transition-transform hover:bg-primary-focus active:scale-95">
          <CheckCheck className="text-primary-foreground" size={12} />
        </div>
      );
    }
    if (somePresent) {
      return (
        <div className="flex h-5 w-5 items-center justify-center rounded-md bg-primary/70 shadow-sm transition-transform hover:bg-primary active:scale-95">
          <Minus className="text-primary-foreground" size={12} />
        </div>
      );
    }
    return (
      <div className="h-5 w-5 rounded-md border-2 border-default-200 transition-colors hover:border-primary/50 hover:bg-primary/5" />
    );
  };

  if (permissionIds.length === 0) {
    return <div className={className} />;
  }

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
