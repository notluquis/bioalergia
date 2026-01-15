import { Check, ChevronDown, ChevronRight, Eye, Pencil, Trash2 } from "lucide-react";
import { Fragment, useState } from "react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/DropdownMenu";
import type { Permission, Role } from "@/types/roles";

import { BulkToggleCell } from "./BulkToggleCell";

// Types corresponding to the processed nav sections
export type MatrixSection = {
  title: string;
  items: MatrixItem[];
  permissionIds: number[];
};

export type MatrixItem = {
  label: string;
  icon: React.ElementType;
  relatedPermissions: Permission[];
  permissionIds: number[];
};

interface PermissionsMatrixTableProps {
  roles: Role[];
  sections: MatrixSection[];
  viewModeRole: string;
  isUpdatingPermissions: boolean;
  updatingRoleId?: number;
  onPermissionToggle: (role: Role, permissionId: number) => void;
  onBulkToggle: (role: Role, permissionIds: number[]) => void;
  onEditRole: (role: Role) => void;
  onDeleteRole: (role: Role) => void;
  onImpersonate: (role: Role) => void;
}

export function PermissionsMatrixTable({
  roles,
  sections,
  viewModeRole,
  isUpdatingPermissions,
  updatingRoleId,
  onPermissionToggle,
  onBulkToggle,
  onEditRole,
  onDeleteRole,
  onImpersonate,
}: PermissionsMatrixTableProps) {
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});
  const [openItems, setOpenItems] = useState<Record<string, boolean>>({});

  const toggleSection = (title: string) => {
    setOpenSections((prev) => ({
      ...prev,
      [title]: !prev[title],
    }));
  };

  const toggleItem = (key: string) => {
    setOpenItems((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const displayRoles = viewModeRole === "all" ? roles : roles.filter((r) => r.id.toString() === viewModeRole);

  const gridTemplateColumns = `320px repeat(${displayRoles.length}, minmax(140px, 1fr))`;

  return (
    <div className="border-base-300 w-full overflow-x-auto border-t">
      <div className="min-w-fit" style={{ display: "grid", gridTemplateColumns }}>
        {/* Header Row */}
        <div className="bg-base-100 border-base-300 sticky top-0 left-0 z-20 border-r border-b px-6 py-4 text-left font-bold">
          Permiso / acción
        </div>
        {displayRoles.map((role) => (
          <div
            key={role.id}
            className="group hover:bg-base-200/50 border-base-300 relative flex flex-col items-center justify-start border-b p-4 text-center align-top"
          >
            <div className="flex flex-col items-center gap-1">
              <span className="line-clamp-2 text-base leading-tight font-bold" title={role.name}>
                {role.name}
              </span>
              <span className="line-clamp-2 text-xs font-normal opacity-70" title={role.description || ""}>
                {role.description || "Sin descripción"}
              </span>

              <div className="mt-2 flex justify-center">
                <DropdownMenu>
                  <DropdownMenuTrigger className="btn btn-ghost btn-xs h-6 w-full gap-1 font-normal opacity-50 hover:opacity-100">
                    Opciones
                    <ChevronDown className="h-3 w-3" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" sideOffset={4}>
                    <DropdownMenuItem onClick={() => onImpersonate(role)}>
                      <Eye className="h-4 w-4" />
                      Previsualizar
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onEditRole(role)}>
                      <Pencil className="h-4 w-4" />
                      Editar
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => onDeleteRole(role)} className="text-error focus:text-error">
                      <Trash2 className="h-4 w-4" />
                      Eliminar
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </div>
        ))}

        {/* Sections */}
        {sections.map((section) => (
          <Fragment key={section.title}>
            {/* Section Title & Bulk Toggle */}
            {/* Section Title & Bulk Toggle */}
            <div className="border-base-300 sticky left-0 z-10 flex border-r border-b">
              <button
                type="button"
                className="bg-base-200/50 hover:bg-base-200/70 flex flex-1 cursor-pointer items-center gap-2 py-3 pl-4 text-xs font-bold tracking-widest uppercase transition-colors"
                onClick={() => toggleSection(section.title)}
              >
                {openSections[section.title] ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
                {section.title}
              </button>
            </div>
            {displayRoles.map((role) => (
              <div
                key={role.id}
                className="bg-base-200/50 hover:bg-base-200/70 border-base-300 flex items-center justify-center border-b p-0 transition-colors"
              >
                <BulkToggleCell
                  role={role}
                  permissionIds={section.permissionIds}
                  isUpdating={isUpdatingPermissions && updatingRoleId === role.id}
                  onToggle={onBulkToggle}
                  variant="section"
                  className="w-full"
                />
              </div>
            ))}

            {/* Collapsible Content */}
            {openSections[section.title] && (
              <div className="contents">
                {section.items.map((item) => {
                  const itemKey = `${section.title}-${item.label}`;
                  const isOpen = !!openItems[itemKey];
                  const hasMultiple = item.relatedPermissions.length > 1;

                  if (hasMultiple) {
                    return (
                      <Fragment key={item.label}>
                        <div className="border-base-300 sticky left-0 z-10 flex border-r border-b">
                          <button
                            type="button"
                            className="bg-base-100/50 hover:bg-base-200/20 flex flex-1 cursor-pointer items-center gap-2 py-3 pl-8 text-sm font-semibold transition-colors"
                            onClick={() => toggleItem(itemKey)}
                          >
                            <div className="text-base-content/40 flex h-4 w-4 items-center justify-center">
                              {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                            </div>
                            <item.icon className="h-4 w-4 opacity-70" />
                            {item.label}
                          </button>
                        </div>
                        {displayRoles.map((role) => (
                          <div
                            key={role.id}
                            className="bg-base-100/50 hover:bg-base-200/20 border-base-300 flex items-center justify-center border-b p-0 transition-colors"
                          >
                            <BulkToggleCell
                              role={role}
                              permissionIds={item.permissionIds}
                              isUpdating={isUpdatingPermissions && updatingRoleId === role.id}
                              onToggle={onBulkToggle}
                              variant="page"
                              className="w-full py-3"
                            />
                          </div>
                        ))}

                        {/* Nested Permissions */}
                        {isOpen &&
                          item.relatedPermissions.map((perm) => (
                            <PermissionRow
                              key={perm.id}
                              perm={perm}
                              displayRoles={displayRoles}
                              onToggle={onPermissionToggle}
                              isUpdating={isUpdatingPermissions}
                              updatingRoleId={updatingRoleId}
                            />
                          ))}
                      </Fragment>
                    );
                  }

                  const perm = item.relatedPermissions[0];
                  if (!perm) return null;

                  const actionMap: Record<string, string> = {
                    read: "Ver",
                    create: "Crear",
                    update: "Editar",
                    delete: "Eliminar",
                  };
                  const actionLabel = actionMap[perm.action] || perm.action;
                  const displayLabel = `${item.label} (${actionLabel})`;

                  return (
                    <Fragment key={perm.id}>
                      <div className="bg-base-100 border-base-300 sticky left-0 z-10 flex flex-col justify-center border-r border-b py-3 pl-8">
                        <span className="flex items-center gap-2 text-sm font-medium">
                          <item.icon className="h-4 w-4 opacity-70" />
                          {displayLabel}
                        </span>
                        <span className="text-base-content/60 pl-6 font-mono text-[10px]">
                          {perm.action} • {perm.subject}
                        </span>
                      </div>
                      {displayRoles.map((role) => (
                        <PermissionCell
                          key={role.id}
                          role={role}
                          permissionId={perm.id}
                          isUpdating={isUpdatingPermissions && updatingRoleId === role.id}
                          onToggle={onPermissionToggle}
                          className="border-base-300 border-b p-0"
                        />
                      ))}
                    </Fragment>
                  );
                })}
              </div>
            )}
          </Fragment>
        ))}
      </div>
    </div>
  );
}

function PermissionCell({
  role,
  permissionId,
  isUpdating,
  onToggle,
  className,
}: {
  role: Role;
  permissionId: number;
  isUpdating: boolean;
  onToggle: (r: Role, i: number) => void;
  className?: string;
}) {
  const hasAccess = role.permissions.some((rp) => rp.permissionId === permissionId);

  return (
    <div className={`flex items-center justify-center ${className || ""}`}>
      <button
        onClick={() => onToggle(role, permissionId)}
        disabled={isUpdating}
        className="group flex h-8 w-8 items-center justify-center transition-colors"
      >
        {hasAccess ? (
          <div className="bg-primary hover:bg-primary-focus flex h-5 w-5 items-center justify-center rounded-md shadow-sm transition-transform active:scale-95">
            <Check size={12} className="text-primary-content" />
          </div>
        ) : (
          <div className="border-base-300 bg-base-100 group-hover:border-primary/50 group-hover:bg-primary/5 h-5 w-5 rounded-md border-2 transition-colors" />
        )}
      </button>
    </div>
  );
}

function PermissionRow({
  perm,
  displayRoles,
  onToggle,
  isUpdating,
  updatingRoleId,
}: {
  perm: Permission;
  displayRoles: Role[];
  onToggle: (role: Role, id: number) => void;
  isUpdating: boolean;
  updatingRoleId?: number;
}) {
  const actionMap: Record<string, string> = {
    read: "Ver",
    create: "Crear",
    update: "Editar",
    delete: "Eliminar",
  };
  const actionLabel = actionMap[perm.action] || perm.action;

  return (
    <div className="contents">
      <div className="bg-base-100 border-base-300 sticky left-0 z-10 flex flex-col justify-center border-r border-b py-2 pl-16 text-sm">
        <span className="flex items-center gap-2 font-medium">{actionLabel}</span>
        <span className="text-base-content/60 font-mono text-[10px]">
          {perm.action} • {perm.subject}
        </span>
      </div>
      {displayRoles.map((role) => (
        <PermissionCell
          key={role.id}
          role={role}
          permissionId={perm.id}
          isUpdating={isUpdating && updatingRoleId === role.id}
          onToggle={onToggle}
          className="border-base-300 border-b"
        />
      ))}
    </div>
  );
}
