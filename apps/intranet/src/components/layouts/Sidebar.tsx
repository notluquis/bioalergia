import { Avatar, Button, Drawer, Dropdown, Label, Separator } from "@heroui/react";
import { useRouter } from "@tanstack/react-router";
import { LogOut, User } from "lucide-react";

import { useAuth } from "@/context/AuthContext";
import { useCan } from "@/hooks/use-can";
import { getNavSections } from "@/lib/nav-generator";
import { cn } from "@/lib/utils";

import { SidebarItem } from "./SidebarItem";

interface SidebarProps {
  readonly isMobile: boolean;
  readonly isOpen: boolean; // For mobile drawer state
  readonly onClose?: () => void;
  readonly sidebarId?: string;
}
export function Sidebar({ isMobile, isOpen, onClose, sidebarId }: SidebarProps) {
  const { logout, user } = useAuth();
  const { can } = useCan();

  const handleNavigate = () => {
    if (isMobile && onClose) {
      onClose();
    }
  };

  const router = useRouter();
  const visibleSections = getNavSections(router.routeTree)
    .map((section) => {
      const filteredItems = section.items.filter((item) => {
        return !(
          item.requiredPermission &&
          !can(item.requiredPermission.action, item.requiredPermission.subject)
        );
      });
      return { ...section, items: filteredItems };
    })
    .filter((section) => section.items.length > 0);

  const displayName =
    user?.name ?? (user?.email ? (user.email.split("@")[0] ?? "Usuario") : "Usuario");

  const sidebarContent = (
    <aside
      id={sidebarId}
      aria-label="Navegación principal"
      aria-hidden={isMobile && !isOpen}
      className="flex flex-col overflow-hidden pt-[env(safe-area-inset-top)] size-full"
    >
      <div
        className={cn(
          "flex h-20 shrink-0 items-center justify-center ",
          isMobile ? "px-5" : "px-0"
        )}
      >
        <div className={cn("relative flex items-center justify-center ", "size-12")}>
          <img
            alt="Bioalergia"
            className={cn("object-contain size-10 ")}
            fetchPriority="high"
            src="/logo_bimi.svg"
          />
        </div>
      </div>

      <div className="flex-1 space-y-6 overflow-y-auto overflow-x-hidden px-2 py-6">
        {visibleSections.map((section, index) => (
          <div className="space-y-4" key={section.title}>
            {index > 0 && !isMobile && (
              <div aria-hidden="true" className="mx-auto w-10 border-default-200 border-t pb-2" />
            )}

            {isMobile && (
              <div className="flex items-center px-4 pb-1">
                <h3 className="font-bold text-xs text-default-600 tracking-[0.2em]">
                  {section.title}
                </h3>
              </div>
            )}

            <div className="space-y-2">
              {section.items.map((item) => (
                <SidebarItem
                  isMobile={isMobile}
                  item={item}
                  key={item.to}
                  onNavigate={() => {
                    handleNavigate();
                  }}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      <div
        className={cn(
          "mt-auto shrink-0 border-default-100/50 border-t bg-background/30 pt-4 pb-8 ",
          isMobile ? "px-3" : "flex flex-col items-center justify-center px-0"
        )}
      >
        <Dropdown>
          <Dropdown.Trigger>
            <Button
              aria-label="Abrir menu de usuario"
              type="button"
              variant="outline"
              className={cn(
                "group flex cursor-pointer items-center outline-none hover:bg-default-50/50",
                isMobile
                  ? "w-full gap-3 rounded-2xl px-3 py-2"
                  : "justify-center rounded-xl p-0 size-12"
              )}
            >
              <Avatar className="shrink-0 size-10">
                <Avatar.Fallback className="bg-background font-bold text-primary">
                  {displayName.slice(0, 2).toUpperCase()}
                </Avatar.Fallback>
              </Avatar>

              {isMobile && (
                <div className="flex min-w-0 flex-1 flex-col gap-0.5 text-left ">
                  <span className="truncate font-semibold text-foreground group-hover:text-primary">
                    {displayName}
                  </span>
                  <span className="truncate text-default-600 text-xs">{user?.email}</span>
                </div>
              )}
            </Button>
          </Dropdown.Trigger>
          <Dropdown.Popover placement="top start">
            <Dropdown.Menu
              aria-label="Menu de usuario"
              className="w-56"
              onAction={(key) => {
                if (key === "account") {
                  void router.navigate({ to: "/account" });
                }
                if (key === "logout") {
                  void logout();
                }
              }}
            >
              <Dropdown.Item id="user" isDisabled textValue={displayName}>
                <div className="flex flex-col py-1">
                  <Label>{displayName}</Label>
                  <span className="text-default-500 text-xs">{user?.email}</span>
                </div>
              </Dropdown.Item>
              <Separator />
              <Dropdown.Item id="account" textValue="Mi cuenta">
                <div className="flex items-center">
                  <User className="mr-2 size-4" />
                  Mi Cuenta
                </div>
              </Dropdown.Item>
              <Dropdown.Item id="logout" textValue="Cerrar sesion" variant="danger">
                <div className="flex items-center">
                  <LogOut className="mr-2 size-4" />
                  Cerrar sesion
                </div>
              </Dropdown.Item>
            </Dropdown.Menu>
          </Dropdown.Popover>
        </Dropdown>
      </div>
    </aside>
  );

  return isMobile ? (
    <Drawer>
      <Drawer.Backdrop
        isOpen={isOpen}
        onOpenChange={(open) => {
          if (!open) {
            onClose?.();
          }
        }}
        variant="opaque"
      >
        <Drawer.Content
          className="w-[min(85vw,320px)] rounded-r-3xl border-r bg-background pl-[env(safe-area-inset-left)] shadow-2xl"
          placement="left"
        >
          <Drawer.Dialog className="relative h-full max-h-dvh p-0">
            <Drawer.CloseTrigger
              aria-label="Cerrar menú"
              className="absolute top-3 right-3 z-10"
            />
            {sidebarContent}
          </Drawer.Dialog>
        </Drawer.Content>
      </Drawer.Backdrop>
    </Drawer>
  ) : (
    <div className="relative z-50 h-full w-20 rounded-2xl border border-default-100 bg-background shadow-xl">
      {sidebarContent}
    </div>
  );
}
