import { Checkbox, Dropdown, ScrollShadow, Separator } from "@heroui/react";
import { Check, ChevronDown, ChevronRight, Eye, Pencil, Trash2 } from "lucide-react";
import { Fragment, useState } from "react";
import { Button } from "@/components/ui/Button";
import type { Permission, Role } from "@/types/roles";

import { BulkToggleCell } from "./BulkToggleCell";

export interface MatrixItem {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  permissionIds: number[];
  relatedPermissions: Permission[];
}

// Types corresponding to the processed nav sections
export interface MatrixSection {
  items: MatrixItem[];
  permissionIds: number[];
  title: string;
}

interface PermissionsMatrixTableProps {
  isUpdatingPermissions: boolean;
  onBulkToggle: (role: Role, permissionIds: number[]) => void;
  onDeleteRole: (role: Role) => void;
  onEditRole: (role: Role) => void;
  onImpersonate: (role: Role) => void;
  onPermissionToggle: (role: Role, permissionId: number) => void;
  roles: Role[];
  sections: MatrixSection[];
  updatingRoleId?: number;
  viewModeRole: string;
}

export function PermissionsMatrixTable({
  isUpdatingPermissions,
  onBulkToggle,
  onDeleteRole,
  onEditRole,
  onImpersonate,
  onPermissionToggle,
  roles,
  sections,
  updatingRoleId,
  viewModeRole,
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

  const displayRoles =
    viewModeRole === "all" ? roles : roles.filter((r) => r.id.toString() === viewModeRole);

  const gridTemplateColumns = `280px repeat(${displayRoles.length}, minmax(160px, 1fr))`;

  return (
    <ScrollShadow className="w-full border-default-200 border-t" orientation="horizontal" size={56}>
      <div className="min-w-fit" style={{ display: "grid", gridTemplateColumns }}>
        {/* Header Row */}
        <div className="sticky top-0 left-0 z-20 border-default-200 border-r border-b bg-default-50/70 px-4 py-4 text-left font-semibold">
          Permiso / acción
        </div>
        {displayRoles.map((role) => (
          <div
            className="group relative flex flex-col items-center justify-start border-default-200 border-b px-3 py-4 text-center align-top hover:bg-default-50/40"
            key={role.id}
          >
            <div className="flex flex-col items-center gap-1">
              <span className="line-clamp-2 font-bold text-base leading-tight" title={role.name}>
                {role.name}
              </span>
              <span
                className="line-clamp-2 font-normal text-xs opacity-70"
                title={role.description || ""}
              >
                {role.description || "Sin descripción"}
              </span>

              <div className="mt-2 flex justify-center">
                <Dropdown>
                  <Dropdown.Trigger>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-full gap-1 font-normal text-default-500 hover:text-foreground"
                    >
                      Opciones
                      <ChevronDown className="h-3 w-3" />
                    </Button>
                  </Dropdown.Trigger>
                  <Dropdown.Popover placement="bottom end">
                    <Dropdown.Menu aria-label="Opciones de rol">
                      <Dropdown.Item
                        onPress={() => {
                          onImpersonate(role);
                        }}
                      >
                        <Eye className="h-4 w-4" />
                        Previsualizar
                      </Dropdown.Item>
                      <Dropdown.Item
                        onPress={() => {
                          onEditRole(role);
                        }}
                      >
                        <Pencil className="h-4 w-4" />
                        Editar
                      </Dropdown.Item>
                      <Separator />
                      <Dropdown.Item
                        className="text-danger focus:text-danger"
                        onPress={() => {
                          onDeleteRole(role);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                        Eliminar
                      </Dropdown.Item>
                    </Dropdown.Menu>
                  </Dropdown.Popover>
                </Dropdown>
              </div>
            </div>
          </div>
        ))}

        {/* Sections */}
        {sections.map((section) => (
          <Fragment key={section.title}>
            {/* Section Title & Bulk Toggle */}
            {/* Section Title & Bulk Toggle */}
            <div className="sticky left-0 z-10 flex border-default-200 border-r border-b">
              <Button
                className="flex flex-1 cursor-pointer items-center gap-2 bg-default-100/40 py-3 pl-4 font-semibold text-xs uppercase tracking-wide transition-colors hover:bg-default-100/60"
                onPress={() => {
                  toggleSection(section.title);
                }}
                type="button"
                variant="ghost"
              >
                {openSections[section.title] ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
                {section.title}
              </Button>
            </div>
            {displayRoles.map((role) => (
              <div
                className="flex items-center justify-center border-default-200 border-b bg-default-100/40 p-0 transition-colors hover:bg-default-100/60"
                key={role.id}
              >
                <BulkToggleCell
                  className="w-full"
                  isUpdating={isUpdatingPermissions && updatingRoleId === role.id}
                  onToggle={onBulkToggle}
                  permissionIds={section.permissionIds}
                  role={role}
                  variant="section"
                />
              </div>
            ))}

            {/* Collapsible Content */}
            {openSections[section.title] && (
              <div className="contents">
                {section.items.map((item) => {
                  const itemKey = `${section.title}-${item.label}`;
                  const isOpen = Boolean(openItems[itemKey]);
                  const hasMultiple = item.relatedPermissions.length > 1;

                  if (hasMultiple) {
                    return (
                      <Fragment key={item.label}>
                        <div className="sticky left-0 z-10 flex border-default-200 border-r border-b">
                          <Button
                            className="flex flex-1 cursor-pointer items-center gap-2 bg-background py-3 pl-8 font-medium text-sm transition-colors hover:bg-default-50/30"
                            onPress={() => {
                              toggleItem(itemKey);
                            }}
                            type="button"
                            variant="ghost"
                          >
                            <div className="flex h-4 w-4 items-center justify-center text-default-300">
                              {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                            </div>
                            <item.icon className="h-4 w-4 opacity-70" />
                            {item.label}
                          </Button>
                        </div>
                        {displayRoles.map((role) => (
                          <div
                            className="flex items-center justify-center border-default-200 border-b bg-background p-0 transition-colors hover:bg-default-50/30"
                            key={role.id}
                          >
                            <BulkToggleCell
                              className="w-full py-3"
                              isUpdating={isUpdatingPermissions && updatingRoleId === role.id}
                              onToggle={onBulkToggle}
                              permissionIds={item.permissionIds}
                              role={role}
                              variant="page"
                            />
                          </div>
                        ))}

                        {/* Nested Permissions */}
                        {isOpen &&
                          item.relatedPermissions.map((perm) => (
                            <PermissionRow
                              displayRoles={displayRoles}
                              isUpdating={isUpdatingPermissions}
                              key={perm.id}
                              onToggle={onPermissionToggle}
                              perm={perm}
                              updatingRoleId={updatingRoleId}
                            />
                          ))}
                      </Fragment>
                    );
                  }

                  const perm = item.relatedPermissions[0];
                  if (!perm) {
                    return null;
                  }

                  const actionMap: Record<string, string> = {
                    create: "Crear",
                    delete: "Eliminar",
                    read: "Ver",
                    update: "Editar",
                  };
                  const actionLabel = actionMap[perm.action] || perm.action;
                  const displayLabel = `${item.label} (${actionLabel})`;

                  return (
                    <Fragment key={perm.id}>
                      <div className="sticky left-0 z-10 flex flex-col justify-center border-default-200 border-r border-b bg-background py-3 pl-8">
                        <span className="flex items-center gap-2 font-medium text-sm">
                          <item.icon className="h-4 w-4 opacity-70" />
                          {displayLabel}
                        </span>
                        <span className="pl-6 font-mono text-[10px] text-default-500">
                          {perm.action} • {perm.subject}
                        </span>
                      </div>
                      {displayRoles.map((role) => (
                        <PermissionCell
                          className="border-default-200 border-b p-0"
                          isUpdating={isUpdatingPermissions && updatingRoleId === role.id}
                          key={role.id}
                          onToggle={onPermissionToggle}
                          permissionId={perm.id}
                          role={role}
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
    </ScrollShadow>
  );
}

function PermissionCell({
  className,
  isUpdating,
  onToggle,
  permissionId,
  role,
}: {
  className?: string;
  isUpdating: boolean;
  onToggle: (r: Role, i: number) => void;
  permissionId: number;
  role: Role;
}) {
  const hasAccess = role.permissions.some((rp) => rp.permissionId === permissionId);

  return (
    <div className={`flex items-center justify-center ${className || ""}`}>
      <Checkbox
        aria-label={`Permiso ${permissionId} para rol ${role.name}`}
        className="justify-center"
        isDisabled={isUpdating}
        isSelected={hasAccess}
        onChange={() => {
          onToggle(role, permissionId);
        }}
      >
        <Checkbox.Control>
          <Checkbox.Indicator>
            {({ isSelected }) => (isSelected ? <Check className="h-3.5 w-3.5" /> : null)}
          </Checkbox.Indicator>
        </Checkbox.Control>
      </Checkbox>
    </div>
  );
}

function PermissionRow({
  displayRoles,
  isUpdating,
  onToggle,
  perm,
  updatingRoleId,
}: {
  displayRoles: Role[];
  isUpdating: boolean;
  onToggle: (role: Role, id: number) => void;
  perm: Permission;
  updatingRoleId?: number;
}) {
  const actionMap: Record<string, string> = {
    create: "Crear",
    delete: "Eliminar",
    read: "Ver",
    update: "Editar",
  };
  const actionLabel = actionMap[perm.action] || perm.action;

  return (
    <div className="contents">
      <div className="sticky left-0 z-10 flex flex-col justify-center border-default-200 border-r border-b bg-background py-2 pl-16 text-sm">
        <span className="flex items-center gap-2 font-medium">{actionLabel}</span>
        <span className="font-mono text-[10px] text-default-500">
          {perm.action} • {perm.subject}
        </span>
      </div>
      {displayRoles.map((role) => (
        <PermissionCell
          className="border-default-200 border-b"
          isUpdating={isUpdating && updatingRoleId === role.id}
          key={role.id}
          onToggle={onToggle}
          permissionId={perm.id}
          role={role}
        />
      ))}
    </div>
  );
}
