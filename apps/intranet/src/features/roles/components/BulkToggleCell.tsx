import { Checkbox } from "@heroui/react";
import { Loader2 } from "lucide-react";

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

  if (permissionIds.length === 0) {
    return <div className={className} />;
  }

  return (
    <div className={`flex items-center justify-center p-0 ${className || ""}`}>
      <Checkbox
        aria-label={`Permisos agrupados para rol ${role.name}`}
        className="justify-center"
        isDisabled={isUpdating}
        isIndeterminate={somePresent}
        isSelected={allPresent}
        onChange={() => {
          onToggle(role, permissionIds);
        }}
      >
        <Checkbox.Control className="size-4 rounded-md border border-default-300 bg-background shadow-xs data-[selected=true]:border-primary data-[selected=true]:bg-primary data-[indeterminate=true]:border-primary data-[indeterminate=true]:bg-primary">
          {isUpdating ? <Loader2 className="h-4 w-4 text-default-300" /> : <Checkbox.Indicator />}
        </Checkbox.Control>
      </Checkbox>
    </div>
  );
}
