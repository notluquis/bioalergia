import { Avatar } from "@heroui/react";
import { Link, useRouter } from "@tanstack/react-router";
import { LogOut, User } from "lucide-react";
import type { ComponentProps } from "react";

import { Backdrop } from "@/components/ui/Backdrop";
import {
  DropdownMenu,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownPopover,
  HeroDropdownMenu,
} from "@/components/ui/DropdownMenu";

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
            <DropdownMenu>
              <DropdownMenuTrigger>
                <button
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
              </DropdownMenuTrigger>
              <DropdownPopover
                placement={"top-start" as ComponentProps<typeof DropdownPopover>["placement"]}
              >
                <HeroDropdownMenu aria-label="Menu de usuario" className="w-56">
                  <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col space-y-1">
                      <p className="font-medium text-sm leading-none">{displayName}</p>
                      <p className="text-default-500 text-xs leading-none">{user?.email}</p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem>
                    <Link className="flex cursor-pointer items-center" to="/account">
                      <User className="mr-2 size-4" />
                      Mi Cuenta
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="cursor-pointer text-danger focus:bg-danger/10 focus:text-danger"
                    onPress={() => logout()}
                  >
                    <LogOut className="mr-2 size-4" />
                    Cerrar sesión
                  </DropdownMenuItem>
                </HeroDropdownMenu>
              </DropdownPopover>
            </DropdownMenu>
          </div>
        </aside>
      </div>
    </>
  );
}
