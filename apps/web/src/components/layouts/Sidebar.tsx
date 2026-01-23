import { Avatar } from "@heroui/react";
import { Link } from "@tanstack/react-router";
import { LogOut, User } from "lucide-react";

import Backdrop from "@/components/ui/Backdrop";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
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

export default function Sidebar({ isMobile, isOpen, onClose }: SidebarProps) {
  const { logout, user } = useAuth();
  const { can } = useCan();

  const handleNavigate = () => {
    if (isMobile && onClose) onClose();
  };

  const visibleSections = getNavSections()
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
      <Backdrop isVisible={isMobile && isOpen} onClose={onClose} zIndex={40} />

      <div
        className={cn(
          "z-50 h-full transition-[width] duration-300 ease-in-out",
          isMobile
            ? "safe-area-left fixed inset-y-0 left-0 w-64 rounded-r-3xl border-r shadow-2xl"
            : "bg-background border-default-100 relative w-20 rounded-2xl border shadow-xl",
          isMobile && (isOpen ? "translate-x-0" : "-translate-x-full"),
        )}
      >
        <aside
          aria-label="Navegación principal"
          className="flex h-full w-full flex-col overflow-hidden"
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
          <div className="flex-1 space-y-6 overflow-x-hidden overflow-y-auto px-2 py-6">
            {visibleSections.map((section, index) => (
              <div className="space-y-4" key={section.title}>
                {/* Section Separator (Desktop) */}
                {index > 0 && !isMobile && (
                  <div
                    aria-hidden="true"
                    className="border-default-200 mx-auto w-10 border-t pb-2"
                  />
                )}

                {/* Section Title (Only visible on mobile) */}
                {isMobile && (
                  <div className="flex items-center px-4 pb-1">
                    <h3 className="text-default-400 text-[10px] font-bold tracking-[0.2em] uppercase">
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
              "border-default-100/50 bg-background/30 mt-auto shrink-0 border-t pt-4 pb-8 transition-all duration-300",
              isMobile ? "px-3" : "flex flex-col items-center justify-center px-0",
            )}
          >
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className={cn(
                    "hover:bg-default-50/50 group flex cursor-pointer items-center transition-all outline-none",
                    isMobile
                      ? "w-full gap-3 rounded-2xl px-3 py-2"
                      : "h-12 w-12 justify-center rounded-xl p-0",
                  )}
                >
                  <Avatar className="h-10 w-10 shrink-0">
                    <Avatar.Fallback className="bg-background text-primary font-bold">
                      {displayName.slice(0, 2).toUpperCase()}
                    </Avatar.Fallback>
                  </Avatar>

                  {isMobile && (
                    <div className="flex min-w-0 flex-1 flex-col gap-0.5 text-left transition-all duration-300">
                      <span className="text-foreground group-hover:text-primary truncate font-semibold transition-colors">
                        {displayName}
                      </span>
                      <span className="text-default-400 truncate text-xs">{user?.email}</span>
                    </div>
                  )}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56" side="top">
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm leading-none font-medium">{displayName}</p>
                    <p className="text-default-500 text-xs leading-none">{user?.email}</p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link className="flex cursor-pointer items-center" to="/account">
                    <User className="mr-2 size-4" />
                    Mi Cuenta
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-danger focus:bg-danger/10 focus:text-danger cursor-pointer"
                  onClick={() => logout()}
                >
                  <LogOut className="mr-2 size-4" />
                  Cerrar sesión
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </aside>
      </div>
    </>
  );
}
