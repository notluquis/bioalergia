import { Avatar, Button, Drawer, Dropdown, Label, Separator, Surface } from "@heroui/react";
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

  // Three reusable building blocks shared by the mobile Drawer (canonical
  // HeroUI Header/Body/Footer composition) and the desktop rail (plain
  // <aside>): logo, scrollable nav, user-menu pill.

  const logoBlock = (
    <div className="flex h-20 shrink-0 items-center justify-center px-5 md:px-0">
      <div className="relative flex items-center justify-center size-12">
        <img
          alt="Bioalergia"
          className="object-contain size-10"
          fetchPriority="high"
          src="/logo_bimi.svg"
        />
      </div>
    </div>
  );

  // Bare section list — the parent (`<nav aria-label="Navegación principal">`)
  // is the navigation landmark. Mobile uses HeroUI Separator between
  // sections (semantic + theme-aware) instead of bare `border-t` divs.
  const navSections = (
    <div className="space-y-6">
      {visibleSections.map((section, index) => (
        <div className="space-y-4" key={section.title}>
          {index > 0 && <Separator aria-hidden="true" className="w-full md:mx-auto md:w-10" />}
          {/* Section heading — visible on mobile drawer, hidden on slim
              desktop rail where icon-only items don't need group labels. */}
          <div className="flex items-center px-4 pb-1 md:hidden">
            <h3 className="font-bold text-xs text-default-600 tracking-[0.2em]">{section.title}</h3>
          </div>
          <div className="space-y-2 md:flex md:flex-col md:items-center">
            {section.items.map((item) => (
              <SidebarItem
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
  );

  const userPill = (
    <Dropdown>
      <Dropdown.Trigger>
        <Button
          aria-label="Abrir menu de usuario"
          className={cn(
            "group flex cursor-pointer items-center outline-none hover:bg-default-50/50",
            // Mobile drawer footer = full-width pill w/ name+email.
            // Desktop slim rail = avatar-only round button.
            "w-full gap-3 rounded-2xl px-3 py-2",
            "md:justify-center md:gap-0 md:rounded-xl md:p-0 md:size-12"
          )}
          type="button"
          variant="outline"
        >
          <Avatar className="shrink-0 size-10">
            <Avatar.Fallback className="bg-background font-bold text-primary">
              {displayName.slice(0, 2).toUpperCase()}
            </Avatar.Fallback>
          </Avatar>
          {/* Name + email — drawer footer only; collapses on slim rail. */}
          <div className="flex min-w-0 flex-1 flex-col gap-0.5 text-left md:hidden">
            <span className="truncate font-semibold text-foreground group-hover:text-primary">
              {displayName}
            </span>
            <span className="truncate text-default-600 text-xs">{user?.email}</span>
          </div>
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
  );

  return isMobile ? (
    /* Canonical HeroUI v3 Drawer composition (per the doc's Anatomy):
       Backdrop > Content > Dialog > [CloseTrigger, Header > Heading,
       Body, Footer]. Visual styling lives on `Drawer.Dialog` — `Drawer.
       Content` is the full-screen positioning wrapper, styling it once
       produced a phantom second panel. `.drawer__body` ships
       `-webkit-overflow-scrolling: touch`, `overscroll-contain` and
       `touch-action: pan-y` — native iOS momentum + no scroll-chaining
       + drag-to-dismiss still works while the body scrolls. */
    <Drawer>
      <Drawer.Backdrop
        isOpen={isOpen}
        onOpenChange={(open) => {
          if (!open) {
            onClose?.();
          }
        }}
        variant="blur"
      >
        <Drawer.Content placement="left">
          <Drawer.Dialog
            className="relative flex h-full max-h-dvh w-[min(85vw,320px)] flex-col overflow-x-clip rounded-r-3xl border-r border-default-200 bg-content1 p-0 pl-[env(safe-area-inset-left)] shadow-2xl"
            id={sidebarId}
          >
            <Drawer.CloseTrigger aria-label="Cerrar menú" className="z-10" />
            <Drawer.Header className="px-0 pt-[env(safe-area-inset-top)]">
              {/* `Drawer.Heading` becomes the dialog's accessible name via
                  React Aria's labelledby plumbing — no manual aria-label
                  on the Dialog needed. */}
              <Drawer.Heading className="sr-only">Navegación principal</Drawer.Heading>
              {logoBlock}
            </Drawer.Header>
            <Drawer.Body className="px-2 py-6 text-foreground">
              <nav aria-label="Navegación principal">{navSections}</nav>
            </Drawer.Body>
            <Drawer.Footer className="mt-0 flex-col items-stretch justify-start gap-0 border-default-100/50 border-t bg-background/30 px-3 pt-4 pb-[calc(env(safe-area-inset-bottom)+1rem)]">
              {userPill}
            </Drawer.Footer>
          </Drawer.Dialog>
        </Drawer.Content>
      </Drawer.Backdrop>
    </Drawer>
  ) : (
    /* Desktop rail: `Surface` (HeroUI v3) for theme-aware elevation
       tokens instead of a bare `<div>` with `bg-background`. The
       primary navigation landmark is the inner `<nav>` — no `<aside>`
       wrapper (that's "complementary content", not navigation, and
       nesting both produces two landmarks for the same region). */
    <Surface
      className="relative z-50 h-full w-20 rounded-2xl border border-default-100 shadow-xl"
      id={sidebarId}
      variant="default"
    >
      <nav
        aria-label="Navegación principal"
        className="flex flex-col overflow-hidden pt-[env(safe-area-inset-top)] size-full"
      >
        {logoBlock}
        {/* Mobile drawer needs px-2 (full-width items in 320px panel);
            desktop rail must drop the padding so items + logo share
            the same horizontal centering reference (rail width). Mixed
            paddings push icons 8px inward from where the logo sits. */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden px-2 py-6 md:px-0">
          {navSections}
        </div>
        <Separator />
        <div className="flex shrink-0 flex-col items-center justify-center bg-background/30 px-0 pt-4 pb-8">
          {userPill}
        </div>
      </nav>
    </Surface>
  );
}
