import { Avatar, Dropdown, Label, Separator } from "@heroui/react";
import { useRouter } from "@tanstack/react-router";
import { LogOut, User } from "lucide-react";

import { Backdrop } from "@/components/ui/Backdrop";

import { useAuth } from "@/context/AuthContext";
import { useCan } from "@/hooks/use-can";
import { getNavSections } from "@/lib/nav-generator";
import { cn } from "@/lib/utils";

import { SidebarItem } from "./SidebarItem";

interface SidebarProps {
  readonly isMobile: boolean;
  readonly isOpen: boolean; // For mobile drawer state
  readonly onClose?: () => void;
}
export function Sidebar({ isMobile, isOpen, onClose }: SidebarProps) {
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

  return (
    <>
      <Backdrop
        className="bg-default-300/60 backdrop-blur-[1px]"
        isVisible={isMobile && isOpen}
        onClose={onClose}
        zIndex={40}
      />

      <div
        className={cn(
          "z-50 h-full transition-[width] duration-300 ease-in-out",
          isMobile
            ? "fixed inset-y-0 left-0 w-[min(85vw,320px)] rounded-r-3xl border-r bg-background pl-[env(safe-area-inset-left)] shadow-2xl"
            : "relative w-20 rounded-2xl border border-default-100 bg-background shadow-xl",
          isMobile && (isOpen ? "translate-x-0" : "-translate-x-full"),
        )}
      >
        <aside
          aria-label="Navegación principal"
          className="flex h-full w-full flex-col overflow-hidden pt-[env(safe-area-inset-top)]"
        >
          {/* Header / Logo */}
          <div
            className={cn(
              "flex h-20 shrink-0 items-center justify-center transition-all duration-300",
              isMobile ? "px-5" : "px-0",
            )}
          >
            {/* Logo Container */}
            <div
              className={cn(
                "relative flex items-center justify-center transition-all duration-300",
                "h-12 w-12",
              )}
            >
              <img
                alt="Bioalergia"
                className={cn("h-10 w-10 object-contain transition-all duration-300")}
                fetchPriority="high"
                src="/logo_bimi.svg"
              />
            </div>
          </div>

          {/* Navigation Content */}
          <div className="flex-1 space-y-6 overflow-y-auto overflow-x-hidden px-2 py-6">
            {visibleSections.map((section, index) => (
              <div className="space-y-4" key={section.title}>
                {/* Section Separator (Desktop) */}
                {index > 0 && !isMobile && (
                  <div
                    aria-hidden="true"
                    className="mx-auto w-10 border-default-200 border-t pb-2"
                  />
                )}

                {/* Section Title (Only visible on mobile) */}
                {isMobile && (
                  <div className="flex items-center px-4 pb-1">
                    <h3 className="font-bold text-[10px] text-default-400 uppercase tracking-[0.2em]">
                      {section.title}
                    </h3>
                  </div>
                )}

                {/* Section Items */}
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

          {/* User Footer */}
          <div
            className={cn(
              "mt-auto shrink-0 border-default-100/50 border-t bg-background/30 pt-4 pb-8 transition-all duration-300",
              isMobile ? "px-3" : "flex flex-col items-center justify-center px-0",
            )}
          >
            <Dropdown>
              <Dropdown.Trigger>
                <button
                  aria-label="Abrir menu de usuario"
                  type="button"
                  className={cn(
                    "group flex cursor-pointer items-center outline-none transition-all hover:bg-default-50/50",
                    isMobile
                      ? "w-full gap-3 rounded-2xl px-3 py-2"
                      : "h-12 w-12 justify-center rounded-xl p-0",
                  )}
                >
                  <Avatar className="h-10 w-10 shrink-0">
                    <Avatar.Fallback className="bg-background font-bold text-primary">
                      {displayName.slice(0, 2).toUpperCase()}
                    </Avatar.Fallback>
                  </Avatar>

                  {isMobile && (
                    <div className="flex min-w-0 flex-1 flex-col gap-0.5 text-left transition-all duration-300">
                      <span className="truncate font-semibold text-foreground transition-colors group-hover:text-primary">
                        {displayName}
                      </span>
                      <span className="truncate text-default-400 text-xs">{user?.email}</span>
                    </div>
                  )}
                </button>
              </Dropdown.Trigger>
              <Dropdown.Popover placement="top start">
                <Dropdown.Menu
                  aria-label="Menu de usuario"
                  className="w-56"
                  onAction={(key) => {
                    if (key === "account") {
                      router.navigate({ to: "/account" });
                    }
                    if (key === "logout") {
                      logout();
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
      </div>
    </>
  );
}
