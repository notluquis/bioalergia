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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/Tooltip";
import { useAuth } from "@/context/AuthContext";
import { useCan } from "@/hooks/useCan";
import { getNavSections, type NavItem } from "@/lib/nav-generator";
import { cn } from "@/lib/utils";

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
        return !(item.requiredPermission && !can(item.requiredPermission.action, item.requiredPermission.subject));
      });
      return { ...section, items: filteredItems };
    })
    .filter((section) => section.items.length > 0);

  const displayName = user?.name ?? (user?.email ? (user.email.split("@")[0] ?? "Usuario") : "Usuario");

  return (
    <TooltipProvider delayDuration={0}>
      <Backdrop isVisible={isMobile && isOpen} onClose={onClose} zIndex={40} />

      <div
        className={cn(
          "z-50 h-full transition-[width] duration-300 ease-in-out",
          isMobile
            ? "safe-area-left fixed inset-y-0 left-0 w-64 rounded-r-3xl border-r shadow-2xl"
            : "bg-base-100 border-base-200 relative w-20 rounded-2xl border shadow-xl",
          isMobile && (isOpen ? "translate-x-0" : "-translate-x-full")
        )}
      >
        <aside aria-label="Navegación principal" className="flex h-full w-full flex-col overflow-hidden">
          {/* Header / Logo */}
          <div
            className={cn(
              "flex h-20 shrink-0 items-center justify-center transition-all duration-300",
              isMobile ? "px-5" : "px-0"
            )}
          >
            {/* Logo Container */}
            <div className={cn("relative flex items-center justify-center transition-all duration-300", "h-12 w-12")}>
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
                  <div aria-hidden="true" className="border-base-content/10 mx-auto w-10 border-t pb-2" />
                )}

                {/* Section Title (Only visible on mobile) */}
                {isMobile && (
                  <div className="flex items-center px-4 pb-1">
                    <h3 className="text-base-content/50 text-[10px] font-bold tracking-[0.2em] uppercase">
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
              "border-base-200/50 bg-base-100/30 mt-auto shrink-0 border-t pt-4 pb-8 transition-all duration-300",
              isMobile ? "px-3" : "flex flex-col items-center justify-center px-0"
            )}
          >
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className={cn(
                    "hover:bg-base-200/50 group flex cursor-pointer items-center transition-all outline-none",
                    isMobile ? "w-full gap-3 rounded-2xl px-3 py-2" : "h-12 w-12 justify-center rounded-xl p-0"
                  )}
                >
                  <div className="bg-base-200 border-base-300 h-10 w-10 shrink-0 overflow-hidden rounded-full border">
                    <div className="bg-base-100 text-primary flex h-full w-full items-center justify-center font-bold">
                      {displayName.slice(0, 2).toUpperCase()}
                    </div>
                  </div>

                  {isMobile && (
                    <div className="flex min-w-0 flex-1 flex-col gap-0.5 text-left transition-all duration-300">
                      <span className="text-base-content group-hover:text-primary truncate font-semibold transition-colors">
                        {displayName}
                      </span>
                      <span className="text-base-content/50 truncate text-xs">{user?.email}</span>
                    </div>
                  )}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56" side="top">
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm leading-none font-medium">{displayName}</p>
                    <p className="text-base-content/60 text-xs leading-none">{user?.email}</p>
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
                  className="text-error focus:bg-error/10 focus:text-error cursor-pointer"
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
    </TooltipProvider>
  );
}

// Sub-component for individual Nav Items to keep main component clean
function SidebarItem({
  isMobile,
  item,
  onNavigate,
}: {
  readonly isMobile: boolean;
  readonly item: NavItem;
  readonly onNavigate: () => void;
}) {
  return (
    <Link
      activeOptions={{ exact: item.to === "/" }}
      className="group outline-none select-none"
      onClick={() => {
        onNavigate();
      }}
      to={item.to as "/"}
    >
      {({ isActive }) => (
        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>
            <div
              className={cn(
                "relative flex items-center rounded-xl transition-all duration-200 ease-in-out",
                isMobile ? "w-full justify-start px-4 py-3" : "mx-auto h-12 w-12 justify-center p-0",
                isActive
                  ? "bg-primary/10 text-primary font-semibold"
                  : "text-base-content/60 hover:text-base-content hover:bg-base-content/5"
              )}
            >
              {/* Active Indicator */}
              {isActive && (
                <span
                  className={cn(
                    "bg-primary absolute rounded-full transition-all duration-300",
                    isMobile ? "top-1/2 left-0 h-6 w-1 -translate-y-1/2" : "top-2 -right-0.5 h-8 w-1"
                  )}
                />
              )}

              {/* Icon */}
              <item.icon
                className={cn(
                  "h-6 w-6 transform-gpu transition-transform duration-200 will-change-transform",
                  isActive ? "scale-110" : "group-hover:scale-110"
                )}
                strokeWidth={isActive ? 2.5 : 2}
              />

              {/* Label (Mobile only, hidden on Slim Desktop) */}
              {isMobile && <span className="ml-4 text-sm font-medium">{item.label}</span>}
            </div>
          </TooltipTrigger>
          {!isMobile && (
            <TooltipContent
              className="bg-base-300 border-base-200 text-base-content z-100 px-3 py-1.5 text-xs font-bold shadow-xl"
              side="right"
              sideOffset={12}
            >
              {item.label}
            </TooltipContent>
          )}
        </Tooltip>
      )}
    </Link>
  );
}
