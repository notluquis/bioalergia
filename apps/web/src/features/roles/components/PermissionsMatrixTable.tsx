import { Check, ChevronDown, ChevronRight, Eye, Pencil, Trash2 } from "lucide-react";
import { Fragment, useState } from "react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/DropdownMenu";
import { SmoothCollapse } from "@/components/ui/SmoothCollapse";
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

  return (
    <div className="border-base-300 w-full overflow-x-auto border-t">
      <div className="min-w-full">
        <table className="table w-auto table-fixed border-collapse">
          <thead>
            <tr>
              <th className="bg-base-100 border-base-300 sticky left-0 z-20 w-[320px] max-w-[320px] min-w-[320px] border-r px-6 text-left">
                Permiso / acción
              </th>
              {displayRoles.map((role) => (
                <th key={role.id} className="group relative w-35 max-w-35 min-w-35 text-center align-top">
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
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sections.map((section) => (
              <Fragment key={section.title}>
                {/* Section Title & Bulk Toggle */}
                <tr
                  className="bg-base-200/50 hover:bg-base-200/70 border-base-300 cursor-pointer border-b transition-colors"
                  onClick={() => toggleSection(section.title)}
                >
                  <td className="bg-base-200 border-base-300 sticky left-0 z-10 w-[320px] max-w-[320px] min-w-[320px] border-r py-3 pl-4 text-xs font-bold tracking-widest uppercase">
                    <div className="flex items-center gap-2">
                      {openSections[section.title] ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                      {section.title}
                    </div>
                  </td>
                  {displayRoles.map((role) => (
                    <BulkToggleCell
                      key={role.id}
                      role={role}
                      permissionIds={section.permissionIds}
                      isUpdating={isUpdatingPermissions && updatingRoleId === role.id}
                      onToggle={onBulkToggle}
                      variant="section"
                    />
                  ))}
                </tr>

                {/* Collapsible Content Row */}
                <tr>
                  <td colSpan={displayRoles.length + 1} className="border-0 p-0">
                    <SmoothCollapse isOpen={!!openSections[section.title]}>
                      <table className="w-full table-fixed border-collapse">
                        <tbody>
                          {section.items.map((item) => {
                            const itemKey = `${section.title}-${item.label}`;
                            const isOpen = !!openItems[itemKey];
                            const hasMultiple = item.relatedPermissions.length > 1;

                            if (hasMultiple) {
                              return (
                                <Fragment key={item.label}>
                                  <tr
                                    className="bg-base-100/50 hover:bg-base-200/20 border-base-100 cursor-pointer border-b transition-colors"
                                    onClick={() => toggleItem(itemKey)}
                                  >
                                    <td className="bg-base-100 border-base-300 w-[320px] max-w-[320px] min-w-[320px] border-r py-3 pl-8 text-sm font-semibold">
                                      <div className="flex items-center gap-2">
                                        <div className="text-base-content/40 flex h-4 w-4 items-center justify-center">
                                          {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                        </div>
                                        <item.icon className="h-4 w-4 opacity-70" />
                                        {item.label}
                                      </div>
                                    </td>
                                    {displayRoles.map((role) => (
                                      <BulkToggleCell
                                        key={role.id}
                                        role={role}
                                        permissionIds={item.permissionIds}
                                        isUpdating={isUpdatingPermissions && updatingRoleId === role.id}
                                        onToggle={onBulkToggle}
                                        variant="page"
                                        className="w-35 max-w-35 min-w-35 py-3"
                                      />
                                    ))}
                                  </tr>

                                  <tr>
                                    <td colSpan={displayRoles.length + 1} className="border-0 p-0">
                                      <SmoothCollapse isOpen={isOpen}>
                                        <table className="w-full table-fixed border-collapse">
                                          <tbody>
                                            {item.relatedPermissions.map((perm) => (
                                              <PermissionRow
                                                key={perm.id}
                                                perm={perm}
                                                displayRoles={displayRoles}
                                                onToggle={onPermissionToggle}
                                              />
                                            ))}
                                          </tbody>
                                        </table>
                                      </SmoothCollapse>
                                    </td>
                                  </tr>
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
                              <tr
                                key={perm.id}
                                className="hover:bg-base-200/50 border-base-100 border-b transition-colors last:border-0"
                              >
                                <td className="bg-base-100 border-base-300 w-[320px] max-w-[320px] min-w-[320px] border-r py-3 pl-8">
                                  <div className="flex flex-col">
                                    <span className="flex items-center gap-2 text-sm font-medium">
                                      <item.icon className="h-4 w-4 opacity-70" />
                                      {displayLabel}
                                    </span>
                                    <span className="text-base-content/60 pl-6 font-mono text-[10px]">
                                      {perm.action} • {perm.subject}
                                    </span>
                                  </div>
                                </td>
                                {displayRoles.map((role) => (
                                  <PermissionCell
                                    key={role.id}
                                    role={role}
                                    permissionId={perm.id}
                                    isUpdating={false}
                                    onToggle={onPermissionToggle}
                                    className="w-35 max-w-35 min-w-35"
                                  />
                                ))}
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </SmoothCollapse>
                  </td>
                </tr>
              </Fragment>
            ))}
          </tbody>
        </table>
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
    <td className={`p-0 text-center align-middle ${className || ""}`}>
      <button
        onClick={() => onToggle(role, permissionId)}
        disabled={isUpdating}
        className="group mx-auto flex h-8 w-8 items-center justify-center transition-colors"
      >
        {hasAccess ? (
          <div className="bg-primary hover:bg-primary-focus flex h-5 w-5 items-center justify-center rounded-md shadow-sm transition-transform active:scale-95">
            <Check size={12} className="text-primary-content" />
          </div>
        ) : (
          <div className="border-base-300 bg-base-100 group-hover:border-primary/50 group-hover:bg-primary/5 h-5 w-5 rounded-md border-2 transition-colors" />
        )}
      </button>
    </td>
  );
}

function PermissionRow({
  perm,
  displayRoles,
  onToggle,
}: {
  perm: Permission;
  displayRoles: Role[];
  onToggle: (role: Role, id: number) => void;
}) {
  const actionMap: Record<string, string> = {
    read: "Ver",
    create: "Crear",
    update: "Editar",
    delete: "Eliminar",
  };
  const actionLabel = actionMap[perm.action] || perm.action;

  return (
    <tr className="hover:bg-base-200/50 border-base-100 border-b transition-colors last:border-0">
      <td className="bg-base-100 border-base-300 w-[320px] max-w-[320px] min-w-[320px] border-r py-2 pl-16 text-sm">
        <div className="flex flex-col">
          <span className="flex items-center gap-2 font-medium">{actionLabel}</span>
          <span className="text-base-content/60 font-mono text-[10px]">
            {perm.action} • {perm.subject}
          </span>
        </div>
      </td>
      {displayRoles.map((role) => (
        <PermissionCell
          key={role.id}
          role={role}
          permissionId={perm.id}
          isUpdating={false}
          onToggle={onToggle}
          className="w-35 max-w-35 min-w-35"
        />
      ))}
    </tr>
  );
}
